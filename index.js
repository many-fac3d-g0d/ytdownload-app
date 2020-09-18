const express = require('express');
const cors = require('cors');
const fs = require('fs');
const cp = require('child_process');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');

let path = require('path');
const app = express();
app.use('/static', express.static('./static'));
app.use(express.static(path.join(__dirname, 'public')));

app.listen((process.env.PORT || 9999),()=>{
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
   
    let videoName = content_name.videoDetails.title;
    videoName = videoName.replace(/[^a-zA-Z ]/g, "_"); // Sanitize video name since it can contain any special char
    //videoName = videoName.replaceAll('-','_');
    console.log(`URL : ${url} ${qual} ${content_name.videoDetails.title} ${videoName}`);
    if(qual==='audio'){
        res.header("Content-Disposition", `attachment;  filename=${videoName}.mp3`);    
        ytdl(url, {filter: 'audioonly'}).pipe(res);
    }
    else{
        res.header("Content-Disposition", `attachment;  filename=${videoName}.mkv`);    
        const video = ytdl(url, {quality:itagValues[qual],filter: 'videoonly'});
        const audio = ytdl(url, { filter: 'audioonly'});

        // Start the ffmpeg child process
        const ffmpegProcess = cp.spawn(ffmpeg, [
            // Remove ffmpeg's console spamming
            '-loglevel', '0', '-hide_banner',
            // Redirect/enable progress messages
            //'-progress', 'pipe:3',
            // 3 second audio offset
            // '-itsoffset', '3.0', 
            '-i', 'pipe:4',
            '-i', 'pipe:5',
            // Rescale the video
            '-vf', 'scale=1980:1080',
            // Choose some fancy codes
            '-c:v', 'libx265', '-x265-params', 'log-level=0',
            '-c:a', 'flac',
            // Define output container
            '-f', 'matroska', 'pipe:6',
        ], {
            windowsHide: true,
            stdio: [
            /* Standard: stdin, stdout, stderr */
            'inherit', 'inherit', 'inherit',
            /* Custom: pipe:3, pipe:4, pipe:5, pipe:6 */
            'pipe', 'pipe', 'pipe', 'pipe',
            ],
        });

        // Link streams

        audio.pipe(ffmpegProcess.stdio[4]);
        video.pipe(ffmpegProcess.stdio[5]);
        ffmpegProcess.stdio[6].pipe(res);

        ffmpegProcess.on('close', () => {
            process.stdout.write('\n\n\n\n');
            console.log('Downloaded successfully');
        });

    }
});