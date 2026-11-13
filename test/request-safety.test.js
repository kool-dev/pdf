const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../pdf-service.js'), 'utf8');

// Exercise the actual route without a network listener, Chromium, or filesystem writes.
async function service() {
    const routes = {};
    const writes = [];
    const pdfs = [];
    const commands = [];
    const removals = [];
    const app = {
        use() {},
        get(route, handler) { routes[route] = handler; },
        post(route, handler) { routes[route] = handler; },
        listen(port, callback) { callback(); },
    };
    const modules = {
        express: () => app,
        compression: () => () => {},
        'body-parser': { urlencoded: () => () => {}, json: () => () => {} },
        puppeteer: {
            launch: async () => ({
                newPage: async () => ({
                    emulateMediaType: async () => {},
                    setViewport: async () => {},
                    goto: async () => {},
                    pdf: async (options) => { pdfs.push(options); },
                    close() {},
                }),
            }),
        },
        fs: {
            existsSync: () => true,
            writeFileSync: (...args) => { writes.push(args); },
            unlinkSync: (filename) => { removals.push(filename); },
        },
        child_process: {
            execFile: (file, args, callback) => {
                commands.push({ file, args: Array.from(args) });
                callback(null, '', '');
            },
            exec: () => { assert.fail('request must not invoke a shell'); },
        },
    };
    vm.runInNewContext(source, {
        require: (name) => Object.hasOwn(modules, name) ? modules[name] : require(name),
        __dirname: path.resolve(__dirname, '..'),
        process: { env: {} },
        console: { log() {} },
    });
    await new Promise(setImmediate);

    async function request(body) {
        const response = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            contentType() { return this; },
            send(body) { this.body = body; return this; },
            sendFile(filename, options, callback) {
                this.file = filename;
                callback();
            },
        };
        await routes['/from-html']({ body, query: {} }, response);
        return response;
    }
    return { request, writes, pdfs, commands, removals };
}

test('compression uses fixed executable and separate arguments', async () => {
    for (const resolution of [undefined, 150, '150']) {
        const app = await service();
        const response = await app.request({ html: '<h1>PDF</h1>', compressionResolution: resolution });
        assert.equal(response.statusCode, 200);
        assert.equal(app.commands.length, 1);
        const command = app.commands[0];
        assert.equal(command.file, 'shinkpdf');
        assert.deepEqual(command.args, [
            '-o', `${app.pdfs[0].path}_compressed.pdf`,
            '-r', resolution === undefined ? '100' : '150', app.pdfs[0].path,
        ]);
        assert.equal(response.file, command.args[1]);
    }
});

test('invalid compression input is rejected before files or commands', async () => {
    for (const resolution of ['100; echo unexpected', '100 extra', '', 0, -1, 1.5,
        {}, { toString: null, valueOf: null }, [], true, 'Infinity', '9007199254740992']) {
        const app = await service();
        const response = await app.request({ html: '<h1>PDF</h1>', compressionResolution: resolution });
        assert.equal(response.statusCode, 400);
        assert.equal(app.writes.length, 0);
        assert.equal(app.pdfs.length, 0);
        assert.equal(app.commands.length, 0);
    }
});

test('caller cannot override generated output path', async () => {
    const app = await service();
    const response = await app.request({
        html: '<h1>PDF</h1>',
        disableCompression: true,
        options: JSON.stringify({ path: '/outside/storage.pdf', format: 'Letter', landscape: true }),
    });
    assert.equal(response.statusCode, 200);
    assert.equal(app.pdfs[0].format, 'Letter');
    assert.equal(app.pdfs[0].landscape, true);
    assert.equal(path.dirname(app.pdfs[0].path), path.resolve(__dirname, '../storage'));
    assert.equal(response.file, app.pdfs[0].path);
    assert.equal(app.commands.length, 0);
    assert.ok(app.removals.includes(app.pdfs[0].path));
});

test('invalid options return a client error before side effects', async () => {
    for (const options of ['{', 'null', 'true', '42', '[]']) {
        const app = await service();
        const response = await app.request({ html: '<h1>PDF</h1>', options });
        assert.equal(response.statusCode, 400);
        assert.equal(app.writes.length, 0);
        assert.equal(app.commands.length, 0);
    }
});

test('missing or non-string HTML returns a client error', async () => {
    for (const html of [undefined, null, {}, [], 42]) {
        const app = await service();
        const response = await app.request({ html });
        assert.equal(response.statusCode, 400);
        assert.equal(app.writes.length, 0);
        assert.equal(app.pdfs.length, 0);
        assert.equal(app.commands.length, 0);
    }
});
