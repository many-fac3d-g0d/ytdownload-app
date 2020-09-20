const express = require('express');
const cors = require('cors');
const fs = require('fs');
const cp = require('child_process');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
//const alert = require('alert');

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

app.get('/download', async (req, res)=>{
    try{
        let itagValues = {'360p':134, '480p':135,'720p':136, '1080p':137}; //itag values video only
        let itagValuesBoth = {'360p':18, '480p':35,'720p':22, '1080p':37}; //itag values audio and video both
        let url = req.query.ytLink;
        let qual = req.query.format;
        if(typeof qual==='undefined'){
            qual = '720p'; // Default resolution set to 720p, if no value given by user
        }
        let content_name = await ytdl.getInfo(url);
        let formats = content_name.formats;
        let itagArr = [];
        for(let i=0;i<formats.length;i++){
            itagArr.push(formats[i].itag);
        }
        console.log(itagArr);
        let videoName = content_name.videoDetails.title;
        videoName = videoName.replace(/[^a-zA-Z0-9]/g, "_"); // Sanitize video name since it can contain any special char
        //videoName = videoName.replaceAll('-','_');
        console.log(`URL : ${url} ${qual} ${content_name.videoDetails.title} ${videoName}`);
        if(qual==='audio'){
            res.header("Content-Disposition", `attachment;  filename=${videoName}.mp3`);    
            ytdl(url, {filter: 'audioonly'}).pipe(res);
        }
        else{
            if((itagArr.includes(itagValues[qual])) || (itagArr.includes(itagValuesBoth[qual]))){ // Do only if requested format is available in YT
                if(itagArr.includes(itagValuesBoth[qual])){ //Both Videoandaudio available no need to combine using ffmpeg
                    res.header("Content-Disposition", `attachment;  filename=${videoName}.mp4`);    
                    ytdl(url, {quality:itagValuesBoth[qual]}).pipe(res);
                }else{
                    res.header("Content-Disposition", `attachment;  filename=${videoName}.mkv`);    
                    const video = ytdl(url, {quality:itagValues[qual],filter: 'videoonly'});
                    const audio = ytdl(url, { filter: 'audioonly', highWaterMark: 1<<25});

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
                        '-reconnect', '1',
                        '-reconnect_streamed', '1',
                        '-reconnect_delay_max', '4',
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
            }
            else{
                console.log('Error in fetching video format: ',qual);
                res.status(404).send('<p>The requested video format is not available, for further queries please contact admin</p><p><a href="http://localhost:9999">Redirect to downloader</a></p>');
            }
            
        }
    }catch(error){
        //alert('The requested video details could not be found, please contact admin :(')
        console.log('Error in fetching video:',error);
        res.status(404).send('<p>Could not find the requested video, please contact admin</p><p><a href="http://ytdownload-app.herokuapp.com/">Redirect to downloader</a></p>');
    }
});
