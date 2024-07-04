const puppeteer = require('puppeteer-core');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

let calls = {
    health: 0,
    fromUrl: 0,
    fromHtml: 0,
};

let browser = null;

async function generatePdf(url, media, options = {}) {
    log('generatePdf: browser.newPage');

    const page = await browser.newPage();

    log('generatePdf: emulateMediaType');

    await page.emulateMediaType(media);
    await page.setViewport({
        width: 1200,
        height: 800,
        isMobile: false,
    });

    log('generatePdf: goto', url);

    await page.goto(url, {
        waitUntil: 'networkidle0',
    });

    let filename = generateFileName() + '.pdf';
    const pdfFilePath = `/tmp/${filename}`;

    options = {
        path: pdfFilePath,
        scale: parseFloat(1),
        format: 'A4',
        printBackground: true,
        ...options
    };

    log('generatePdf: generate PDF', pdfFilePath, options);

    await page.pdf(options);

    page.close();

    return pdfFilePath;
}

function generateFileName() {
    return crypto.randomBytes(20).toString('hex')
}

function log(...messages) {
    let date = new Date().toISOString().replace('T', ' ').substr(0, 19)

    console.log(`[${date}]`, ...messages);
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

exports.startPuppetter = async () => {
    log('Going to start puppeter');

    browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
            '--headless',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--single-process',
        ],
    });

    log('Started puppeteer; setting service state to Ready');
}

exports.fromHtml = async (html, media = 'screen', disableCompression = false, compressionResolution = 100, options = {}) => {
    log('/from-html');

    calls.fromHtml++;

    media ||= 'screen';
    disableCompression ||= false;
    compressionResolution ||= 100;
    options = getPdfOptions(options || {});

    const htmlFile = generateFileName() + '.html';
    const fullHtmlPath = `/tmp/${htmlFile}`;

    fs.writeFileSync(fullHtmlPath, html);

    let pdfFilePath;

    try {
        pdfFilePath = await generatePdf(`file://${fullHtmlPath}`, media, options);
    } catch (err) {
        log('/from-html: error generating PDF', err);

        throw new Error('Error generating PDF');
    } finally {
        fs.unlinkSync(fullHtmlPath);
    }

    const compressedFilePath = `${pdfFilePath}_compressed.pdf`;

    if (disableCompression) {
        return pdfFilePath;
    } else {
        // compress PDF outoput
        const cmd = `shinkpdf -o ${compressedFilePath} -r ${compressionResolution} ${pdfFilePath}`;

        try {
            const output = execSync(cmd).toString();

            log('Compressing - out:', output);

            fs.unlinkSync(pdfFilePath);

            return compressedFilePath;
        } catch (err) {
            log('Compressing - err:', err);

            return pdfFilePath;
        }
    }
}
