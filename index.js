require('dotenv').config();
const express = require("express");
const axios = require("axios");
const puppeteer = require('puppeteer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs/promises');
const EventEmitter = require('events');
const excelJS = require("exceljs");
const _ = require('lodash');
const emitter = new EventEmitter()
// emitter.setMaxListeners(100)
// or 0 to turn off the limit
emitter.setMaxListeners(0)

const port = process.env.PORT || 3000;
const reqURL = 'https://is-api.dent.cz/api/v1/web/workplaces';

const app = express();
app.use(cors());
app.use('/public', express.static(__dirname+'/public'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.get('/', (req, res) => {
    res.sendFile(__dirname+'/views/index.html');
})

app.post('/v1/scrap', async (req, res) => {
    const URL = req.body.url;
    console.log(URL);
    await startScraping(URL);
    res.json("Working on it");
})

app.post('/v2/scrap', async (req, res) => {
    const URL = req.body.url;
    console.log(URL);
    await startScraping2(URL);
    res.json("Working on it");
});

app.listen(port, () => {
    console.log(`Server is listening at ${port}`);
})

async function startScraping(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url,{waitUntil: "networkidle0"});
    // await page.screenshot({path: 'amazing.png', fullPage: true});

    // get urls 
    const urls = await page.evaluate(() => {
        // browser chrome land
        // we can do everthing we do in browser
        return Array.from(document.querySelectorAll(".cross-cross-dentists-list > div > div > h3 > a")).map(x => x.href);
    })
    
    // write tghe urls into a file
    fs.writeFile('urls.txt', urls.join("\r\n"));

    // call the urls and get data from them
    const promises = [];
    for(let x in urls) {
        const tempPromise = getAndSaveDataFromUrl(urls[x]);
        promises.push(tempPromise);
    }

    const values = await Promise.all(promises);
    // console.log(values);
    await fs.writeFile('PromiseAllThen.txt', JSON.stringify(values));
    await browser.close();

    savedataToExcel();
}

async function startScraping2(url) {
    const browser = await puppeteer.launch({
        args: [
          '--disable-web-security',
        ],
        // headless: false,
      });
    const page = await browser.newPage();

    // get urls
    let reqPayload = {};
    let resData = {};
    page.on('response',async (response) => {
        if(response.url().includes(reqURL)){
            reqPayload = response.request().postData();
            resData = await response.json();
        }
    });

    await page.goto(url, {waitUntil: "networkidle0"});

    let newReqPayload = {
        ...reqPayload,
        page: 1,
        per_page: resData.pagination.object_count
    }

    let allResData = await axios.post(reqURL, newReqPayload)
                                .then(response => response.data)
                                .catch(err => []);
    // console.log(allResData);
    let urls = Array.from(allResData.data).map(item => {
        return { 
            url: `${reqURL}/${item.id}`, 
            phone: (item.contact && (item.contact.phone1 || item.contact.phone2)) ? (item.contact.phone1 || item.contact.phone2) : "" }
    });
    // console.log(urls);
    
    // write tghe urls into a file
    await fs.writeFile('urls.txt', urls.join("\r\n"));
    console.log('urls updated in file');

    // call the urls and get data from them
    // const promises = [];
    const values = []
    for(let x in urls) {
        console.log(`${x} urls done`);
        if( x >= 300) {
            break;
        }
        let tempPromise = {data:{},phone_number:urls[x].phone}
        tempPromise.data = await getAndSaveDataFromUrl2(urls[x].url);
        // promises.push(tempPromise);
        // tempPromise.phone_number = urls[x].phone;
        values.push(tempPromise)
    }

    // const values = await Promise.all(promises);
    // console.log(values);
    await fs.writeFile('PromiseAllThen.txt', JSON.stringify(values));
    await browser.close();

    await savedataToExcel();
}

async function getAndSaveDataFromUrl2(url) {
    return await axios.get(url)
                    .then(response => response.data)
                    .catch(err => {});
}

async function getAndSaveDataFromUrl(url) {
    const browser = await puppeteer.launch({
        args: [
          '--disable-web-security',
        ],
        // headless: false,
      });
    const page = await browser.newPage();
    // await page.setRequestInterception(true);
    let responseObj = {};
    

     // Enable request interception
    // page.on('request', req => {
    //     // console.log('request : ', req.url());
    //     if (req.url().includes('https://is-api.dent.cz/api/v1/web/workplaces/') || req.url().includes('https://www.dent.cz/zubar/')) {
    //         console.log('request : ',req.url())
    //         req.continue();
    //     } else {
    //         req.abort();
    //     }

    // });

    // Enable response interception
    // const finalResponse = await page.waitForResponse(response => response.url().startsWith('https://is-api.dent.cz/api/v1/web/workplaces/') 
    //                                                             && response.request().method() === 'GET');
    // let responseJson = await finalResponse.json();
    // console.log(responseJson);
    
    
    page.on('response',async (response) => {
        
        if(response.url().includes(reqURL)){
            
        // console.info("URL", response.url());
        // console.info("response", await response.request().response());
        // console.info("Method", response.request().method())
        // console.info("Response headers", response.headers())
        // console.info("Response ok", response.ok())
        if(response.ok()){
            responseObj = await response.json();
        }

        // Use this to get the content as text
        // const responseText = await response.text();
        // ... or as buffer (for binary data)
        // const responseBuffer = await response.buffer();
        // ... or as JSON, if it's a JSON (else, this will throw!)

            // responseObj = await response.json();
        // await fs.writeFile(response.request().url().replace('https://is-api.dent.cz/api/v1/web/workplaces/', '')+'.txt', response.request().response())
        }
    })
    
    // console.log(url)
    await page.goto(url);

    await browser.close;
    return responseObj;
}

async function savedataToExcel() {
    let data2 = await fs.readFile('PromiseAllThen.txt');
    data2 = JSON.parse(data2);

    const workbook = new excelJS.Workbook();  // Create a new workbook
    const worksheet = workbook.addWorksheet("My Users"); // New Worksheet

    const path = "./files";  // Path to download excel

    // Column for data in excel. key must match data key
    worksheet.columns = [
        { header: "S no.", key: "s_no", width: 10 },
        { header: "Doctor Name", key: "dname", width: 20 },
        { header: "Branch Name", key: "bname", width: 20 },
        { header: "Address", key: "address", width: 30 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phone", width: 20 },
        { header: "Website", key: "website", width: 30 },
    ];

    // Looping through User data
    let counter = 1;
    data2.forEach((user) => {
        const item = {};
        if(!_.isEmpty(user.data)) {
            item.s_no = counter;
            item.dname = (user.data.membes &&  user.data.membes.length) ? user.data.membes[0].full_name : "";
            item.bname = user.data.name || "";
            item.address = user.data.address && user.data.address.print ? user.data.address.print : "";
            item.email = user.data.contact && (user.data.contact.email1 || user.data.contact.email2) ? (user.data.contact.email1 || user.data.contact.email2) : "";
            item.phone = user.phone_number || "";
            item.website = user.data.contact && user.data.contact.web ? user.data.contact.web : "";

            worksheet.addRow(item); // Add data in worksheet
            counter++;
        } 
    });

    // Making first line in excel bold
    worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
    });

    try {
        const data = await workbook.xlsx.writeFile(__dirname+`/users.xlsx`)
            .then(() => {
                // res.send({
                //     status: "success",
                //     message: "file successfully downloaded",
                //     path: `${path}/users.xlsx`,
                // });
                console.log("Excel file created");
            });
    } catch (err) {
        // res.send({
        //     status: "error",
        //     message: "Something went wrong",
        // });
        console.log(err);
    }
}