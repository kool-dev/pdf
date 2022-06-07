const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
const bodyParser = require('body-parser');
const compression = require('compression');
const { exec } = require('child_process');

app.use(compression());
app.use(bodyParser.urlencoded({
    extended: true,
    limit: process.env.REQUEST_SIZE_LIMIT || '400mb',
    parameterLimit: 1000,
})); // support encoded bodies
app.use(bodyParser.json({
    limit: process.env.REQUEST_SIZE_LIMIT || '400mb',
})); // support json encoded bodies

const storagePath = path.join(__dirname, 'storage');
if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath);
}

let port = 3000;
let calls = {
    health: 0,
    fromUrl: 0,
    fromHtml: 0,
};
let isReady = false;
let browser = null;

app.get('/health', (req, res) => {
    log('/health');

    calls.health++;

    deliverJson(res, {isReady, calls}, isReady ? 200 : 503);
});

app.post('/from-html', async (req, res) => {
    log('/from-html');

    calls.fromHtml++;

    const html = req.body.html;
    const disableCompression = req.body.disableCompression || false;
    const compressionResolution = req.body.compressionResolution || 100;
    const options = getPdfOptions(req.body.options);
    const htmlFile = generateFileName() + '.html';
    const fullHtmlPath = path.join(storagePath, htmlFile);

    fs.writeFileSync(fullHtmlPath, html);

    let pdfFilePath;
    try {
        pdfFilePath = await generatePdf(`file://${fullHtmlPath}`, req.query.media, options);

        fs.unlinkSync(fullHtmlPath);
    } catch (err) {
        log('/from-html: error generating PDF', e);
        deliverJson(res, {msg: 'failure generating PDF', err}, 500);

        return;
    }

    const compressedFilePath = `${pdfFilePath}_compressed.pdf`;

    if (disableCompression) {
        deliverPdfFile(res, pdfFilePath);
    } else {
        // compress PDF outoput
        const cmd = `shinkpdf ${pdfFilePath} ${compressedFilePath} ${compressionResolution}`;
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                console.log('Compressing - err:', err);
            }
            if (stdout || stderr) {
                console.log('Compressing - out/err:', stdout, stderr);
            }

            deliverPdfFile(res, err ? pdfFilePath : compressedFilePath);
            fs.unlinkSync(pdfFilePath);
        });
    }
});

app.get('/from-url', async (req, res) => {
    log('/from-url');

    calls.fromUrl++;
    let url = req.query.url;

    if (!url) {
        deliverJson(res, {msg: 'missing parameter: \'url\'', params: req.params}, 400);
        return;
    }

    try {
        let pdfFilePath = await generatePdf(withHttp(url), req.query.media);

        deliverPdfFile(res, pdfFilePath);
    } catch (err) {
        log('/from-url: error generating PDF', e);
        let msg = 'failure generating PDF';

        deliverJson(res, {msg, err}, 500);
    }
});

function withHttp (url) {
    return !/^https?:\/\//i.test(url)
        ? `http://${url}`
        : url;
}

function deliverJson(res, resp, status = 200) {
    res.status(status).contentType('json').send(resp);
}

function deliverPdfFile(res, pdfFilePath) {
    log('deliverPdfFile: going to deliver PDF', pdfFilePath);

    const reader = fs.createReadStream(pdfFilePath);

    res.setHeader('Content-Length', fs.statSync(pdfFilePath).size);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    reader.on('open', () => {
        reader.pipe(res);
    });
    reader.on('close', () => {
        log('deliverPdfFile: going to remove file', pdfFilePath);
        fs.unlinkSync(pdfFilePath);
    });
}

async function generatePdf(url, media, options = {}) {
    log('generatePdf: browser.newPage');

    const page = await browser.newPage();

    log('generatePdf: emulateMediaType');

    await page.emulateMediaType(media || 'screen');
    await page.setViewport({
        width: 1200,
        height: 800,
        isMobile: false,
    });

    log('generatePdf: goto', url);

    await page.goto(url, {
        waitUntil: 'networkidle2',
    });

    let filename = generateFileName() + '.pdf';
    const pdfFilePath = path.join(storagePath, filename);

    log('generatePdf: generate PDF', pdfFilePath);
    await page.pdf({
        path: pdfFilePath,
        scale: parseFloat(1),
        format: 'A4',
        printBackground: true,
        ...options
    });

    page.close();

    return pdfFilePath;
}

function generateFileName() {
    return crypto.randomBytes(20).toString('hex')
}

function log(message) {
    let date = new Date().toISOString().replace('T', ' ').substr(0, 19)

    console.log(`[${date}] ${message}`);
}

function getPdfOptions(options) {
    if (typeof options !== 'string') {
        return {};
    }

    const parsedOptions = JSON.parse(options);

    let mappedOptions = {};

    [
        'path',
        'scale',
        'displayHeaderFooter',
        'headerTemplate',
        'footerTemplate',
        'printBackground',
        'landscape',
        'pageRanges',
        'format',
        'width',
        'height',
        'margin',
        'preferCSSPageSize',
    ].forEach(prop => {
        if (parsedOptions[prop] === undefined) {
            return;
        }

        mappedOptions[prop] = parsedOptions[prop];
    });

    return mappedOptions;
}

app.listen(port, () => {
    log(`Kool PDF service running at port ${port}`);
    log('Going to start puppeter');

    (async () => {
        browser = await puppeteer.launch({
            args: [
                '--headless',
                '--no-sandbox',
                '--disable-dev-shm-usage',
            ],
        });

        log('Started puppeteer; setting service state to Ready');
        isReady = true;
    })();
});
