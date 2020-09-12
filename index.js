const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
var path = require('path');
const app = express();
app.use('/static', express.static('./static'));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(9999,()=>{
    console.log("Server started at http://localhost:9999/");
});

app.get('/', (req, res) => { 
    res.sendFile('index.html',{ root: './' });
});

app.get('/download', (req, res) => {
    var url = req.query.ytLink;
    console.log(`URL : ${url}`);    
    res.header("Content-Disposition", 'attachment;\  filename="Video.mp4');    
    ytdl(url, {format: 'mp4'}).pipe(res);
});