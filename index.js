//import the needed modules
const puppeteer = require('puppeteer'); 
const express = require('express'); 
const path = require('path'); 

const app = express();
const port = 3000; //set the port

app.use(express.json());

let broswer;

//serve the HTNL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

//add the endpoint for the scraping requirement
app.post('/scrape', async (req, res) => {
    try{
        const {url} = req.body;
        if(!url){
            return res.status(400).json({error: 'URL is needed!'});
        }

        //make the browser wait for the puppeteer module
        browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, {waitUntil: 'domcontentloaded'});

        //wait for the page link selector
        await page.waitForSelector('a');

        //retireve the title name, the short description, the overall sentiment and the word count
        const linkTextArray = await page.evaluate(() => {
          //function for the analysis of the sentiment
          function analyzeSentiment(text) {
            const positiveWords = ["joy", "enriching", "exciting", "happy", "positive", "well-being", "excellent", "splendid", "fantastic", "nice", "vibrant", "joyful", "radiant"];
            const negativeWords = ["sad", "disappointing", "negative", "unpleasant", "bad", "critical", "junk"];
            const neutralWords = ["neutral", "impartial", "ok", "ordinary", "unbiased"];

            //applying the algorithm based on semantics
            let positiveCount = 0;
            let negativeCount = 0;
            let neutralCount = 0;
    
            //count each appearance of the sentiment words
            for (const word of text.split(" ")) {
              if (positiveWords.includes(word)) {
                positiveCount++;
              } else 
                  if (negativeWords.includes(word)) {
                     negativeCount++;
              } else 
                  if (neutralWords.includes(word)) {
                    neutralCount++;
              }
            }
    
            if (positiveCount > negativeCount && positiveCount > neutralCount) { //determine the overall sentiment
              return "positive";
            } else 
                if (negativeCount > positiveCount && negativeCount > neutralCount) {
                   return "negative";
                } 
                else {
                     return "neutral";
                }
          }

            //apply the found rule (the title and the description can be found every 2 links, starting from the second one)
            const links = Array.from(document.querySelectorAll('a'));
            const textArray = [];

            for(let i = 1; i < links.length; i += 2){
                const title = links[i].textContent;
                const link = links[i];
                const description = link.parentElement.nextElementSibling.textContent.trim();
                const sentimentTitle = analyzeSentiment(title);
                const sentimentDescription = analyzeSentiment(description);

                //determine the overall sentiment for the pairs of titles-descriptions
                let overallSentiment;
                if(sentimentTitle === "positive" || sentimentDescription === "positive"){
                    overallSentiment = "positive";
                }
                else
                    if(sentimentTitle === "negative" || sentimentDescription === "negative"){
                        overallSentiment = "negative";
                    }
                    else{
                        overallSentiment = "neutral";
                    }

                //count the words in the title and description
                const wordCount = title.split(" ").length + description.split(" ").length;

                textArray.push({
                    title,
                    description,
                    overallSentiment,
                    wordCount,
                });
            }
            return textArray;
        });

        //determine the href based on the rule, that it can be found on every second link, starting from the first one
        const imageArray = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const textArray = [];

            for(let i = 0; i < links.length; i += 2){
                const href = links[i].getAttribute('href');
                textArray.push(href);
            }

            return textArray;
        });

        //determine the image name, based on the same rule as above
        const imageArray2 = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('img'));
            const textArray = [];

            for(let i = 0; i < links.length; i += 2){
                const href = links[i].getAttribute('src');
                textArray.push(href);
            }

            return textArray;
        });

        //log into console the data (titles, short description, images, hrefs, sentiments and words)
        for(const item of linkTextArray){
            console.log('Title:', item.title);
            console.log('Short_description:', item.description);
            console.log('Image:', imageArray2[linkTextArray.indexOf(item)] || 'Image URL not found!');
            console.log('HREF:', imageArray[linkTextArray.indexOf(item)] || 'HREF not found!');
            console.log('Sentiment:', item.overallSentiment);
            console.log('Words:', item.wordCount);
            
        }

        //build the results
        const results = linkTextArray.map((item, index) => ({
            title: item.title,
            short_description: item.description,
            image: imageArray2[index] || 'Image URL not found!',
            href: imageArray[index] || 'HREF not found!',
            sentiment: item.overallSentiment,
            words: item.wordCount,
        }));

        //send the JSON response
        res.json(results);
    } catch(error){
        console.error('Error scraping:', error);
        res.status(500).json({error: 'An error occured (scraping)!'});
    } finally{
        if(browser){
            await browser.close();
        }
    }
});

//add the endpoint to also count the words for every post from the page
app.post('/count-words', async (req, res) => {
    try{
        const {url} = req.body;
        if(!url){
            return res.status(400).json({error: 'URL required!'});
        }

        browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url, {waitUntil: 'domcontentloaded'});

        //wait for the content to load
        await page.waitForSelector('body');

        const pageContent = await page.evaluate(() => {
            return document.body.innerText;
        });

        //split the page content in words
        const words = pageContent.split(/\s+/);

        //count the words of the page
        const wordCount = words.length;

        //log the count word
        console.log('Word count:', wordCount);

        //send the json response
        res.json({wordCount});
    } catch(error){
        console.error("Error while counting words:", error);
        res.status(500).json({error: 'An error occured while counting words'});
    } finally {
        if(browser){
            await browser.close();
        }
    }
});

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});