const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const app = express();

let port = 3000;
let calls = {
    health: 0,
    fromUrl: 0,
};
let isReady = false;
let browser = null;
let storagePath = 'storage';

app.get('/health', (req, res) => {
    calls.health++;
    console.log('serving /health');
    deliverJson(res, {isReady, calls}, isReady ? 200 : 503);
});

app.get('/from-html', async (req, res) => {
});

app.get('/from-url', async (req, res) => {
    calls.fromUrl++;
    const url = req.query.url;
    console.log('/from-url');

    if (!url) {
        let msg = 'missing parameter: \'url\'';
        deliverJson(res, {msg, params: req.params}, 400);
        return;
    }

    let pdfFilePath;
    try {
        pdfFilePath = await generatePdf(url);
    } catch (err) {
        console.log('/from-url: error generating PDF', e);
        let msg = 'failure generating PDF';
        deliverJson(res, {msg, err}, 500);
        return;
    }

    deliverPdfFile(res, pdfFilePath);
});

function deliverJson(res, resp, status = 200) {
    res.status(status).contentType('json').send(resp);
}

function deliverPdfFile(res, pdfFilePath) {
    console.log('deliverPdfFile: going to deliver PDF', pdfFilePath);
    const reader = fs.createReadStream(pdfFilePath);
    res.setHeader('Content-Length', fs.statSync(pdfFilePath).size);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    reader.pipe(res);

    console.log('deliverPdfFile: going to remove file', pdfFilePath);
    fs.unlinkSync(pdfFilePath);
}

async function generatePdf(url) {
    console.log('generatePdf: browser.newPage');
    const page = await browser.newPage();

    console.log('generatePdf: emulateMediaType');
    await page.emulateMediaType('screen');

    console.log('generatePdf: goto', url);
    await page.goto(url, {
        waitUntil: 'networkidle2',
    });

    let filename = crypto.createHash('md5').update(url).digest('hex') + '.pdf';
    const pdfFolder = path.join(__dirname, storagePath);
    if (!fs.existsSync(pdfFolder)) {
        fs.mkdirSync(pdfFolder);
    }
    const pdfFilePath = path.join(pdfFolder, filename);

    console.log('generatePdf: generate PDF', pdfFilePath);
    await page.pdf({
        path: pdfFilePath,
        scale: parseFloat(1),
        format: 'A4',
        // displayHeaderFooter: false,
        // printBackground: false,
        // landscape: false,
    });

    return pdfFilePath;
}

app.listen(port, () => {
    console.log(`Kool PDF service running at port ${port}`);
    console.log(`Going to start puppeter`);

    (async () => {
        browser = await puppeteer.launch({
            args: [
                '--headless',
                '--no-sandbox',
                '--disable-dev-shm-usage',
            ],
        });

        console.log('Started puppeteer; setting service state to Ready');
        isReady = true;
    })();
});
