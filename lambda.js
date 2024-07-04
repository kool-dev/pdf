const fs = require('fs');
const { fromHtml, startPuppetter } = require('./pdf');

exports.handler = async (event) => {
    await startPuppetter();

    switch (event.path) {
        case '/from-html':
            let pdfPath;

            try {
                pdfPath = await fromHtml(event.html, event.media, event.disableCompression, event.compressionResolution, event.options);

                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/pdf' },
                    body: fs.readFileSync(pdfPath).toString('base64'),
                };
            } catch (err) {
                return {
                    statusCode: 500,
                    body: JSON.stringify(err),
                };
            } finally {
                if (pdfPath) { fs.unlinkSync(pdfPath); }
            }
        default:
            return {
                statusCode: 404,
                body: JSON.stringify('Not Found'),
            };
    }
};
