require('dotenv').config();
const fs = require('fs');
const app = require('./lib/app');
const rimraf = require('rimraf');

const templateNames = fs.readdirSync('./config/templates')
    .filter(filename => filename.lastIndexOf('.json') !== -1);

console.log('creating/cleaning temp folder\n');
rimraf.sync('./temp');
fs.mkdirSync('./temp');

for (const templateName of templateNames) {
    console.log(`transforming ${templateName}...`);
    const template = require(`./config/templates/${templateName}`);
    template.data.images = template.data.images.map(image => {
        const filename = `./config/images/${image.data}`;
        console.log(`converting ${filename} to base64 string`);
        const data = fs.readFileSync(filename).toString('base64');
        return { identifier: image.identifier, data };
    });
    console.log(`saving ${templateName}...`);
    fs.writeFileSync(`./temp/${templateName}`, JSON.stringify(template));
    console.log(`${templateName} transformed\n`);
}

app.init(message => console.log(message));
