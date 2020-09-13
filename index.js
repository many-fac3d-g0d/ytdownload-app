const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
let path = require('path');
const app = express();
app.use('/static', express.static('./static'));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(9999,()=>{
    console.log("Server started at http://localhost:9999/");
});

app.get('/', (req, res) => { 
    res.sendFile('index.html',{ root: './' });
});

app.get('/download', async (req, res) => {
    let itagValues = {'360p':134, '480p':135,'720p':136, '1080p':137}; //itag values
    let url = req.query.ytLink;
    let qual = req.query.format;
    if(typeof qual==='undefined'){
        qual = '720p'; // Default resolution set to 720p, if no value given by user
    }
    let content_name = await ytdl.getInfo(url);
    console.log(`URL : ${url} ${qual} ${content_name.videoDetails.title}`);
    if(qual==='audio'){
        res.header("Content-Disposition", `attachment;  filename=${content_name.videoDetails.title}.mp3`);    
        ytdl(url, {filter: 'audioonly'}).pipe(res);
    }
    else{
        res.header("Content-Disposition", `attachment;  filename=${content_name.videoDetails.title}.mp4`);    
        ytdl(url, {quality:itagValues[qual],format: 'mp4'}).pipe(res);
    }
});