const express = require('express');
const cors = require('cors');
const fs = require('fs');
const cp = require('child_process');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
//const alert = require('alert');

let path = require('path');
const { time } = require('console');
const app = express();
app.use('/static', express.static('./static'));
app.use(express.static(path.join(__dirname, 'public')));

var server = app.listen((process.env.PORT || 9999),()=>{
    console.log("Server started at http://localhost:9999/");
});
//server.setTimeout(30000);
app.get('/', (req, res) => { 
    res.sendFile('index.html',{ root: './' });
});

app.get('/download', async (req, res)=>{
    try{
            let itagValues = {'360p':134, '480p':135,'720p':136, '1080p':137, '1080p60':299}; //itag values video only
            let itagValuesBoth = {'360p':18, '480p':35,'720p':22, '1080p':37}; //itag values audio and video both
            let url = req.query.ytLink;
            let startRange = req.query.startRange;
            let endRange = req.query.endRange;
            let timeArr1, timeArr2, diff, date, duration, startSeconds, endSeconds;

            //console.log("Trim : ",startRange," ",endRange);
            //Calculate time duration only if range specified by user
            if(startRange!=='' || endRange!==''){
                timeArr1 = startRange.split(':');
                timeArr2 = endRange.split(':');
                if(timeArr1.length===3 && timeArr2.length===3){
                    startSeconds = (+timeArr1[0])*60*60 + (+timeArr1[1])*60 + (+timeArr1[2]);
                    endSeconds = (+timeArr2[0])*60*60 + (+timeArr2[1])*60 + (+timeArr2[2]);
                }
                else if(timeArr1.length===2 && timeArr2.length===2){
                    startSeconds = (+timeArr1[0])*60 + (+timeArr1[1]);
                    endSeconds = (+timeArr2[0])*60 + (+timeArr2[1]);
                }
                else{
                    console.log('Not a valid time format: ',startRange," - ",endRange);
                        res.status(404).send('<p>The range values specified is invalid, also please check : char in time as in youtube video timeline</p><p><a href="http://ytdownload-app.herokuapp.com/">Redirect to downloader</a></p>');
                }
                diff = endSeconds - startSeconds;
                console.log(" Time Difference :",diff);
                date = new Date(0);
                date.setSeconds(diff);
                duration = date.toISOString().substr(11, 8);
                console.log("Time Duration : ",duration);

                console.log("Range : ",startRange," - ",endRange);
            }
            
            let qual = req.query.format;
            if(qual===undefined){
                qual = '720p'; // Default resolution set to 720p, if no value given by user
            }
            let content_name = await ytdl.getInfo(url);
            console.log("Total duration ",content_name.videoDetails.lengthSeconds);
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
            if(startRange!=='' || endRange!==''){ //When user specified startRange or endRange trim the video using ffmpeg before piping to res
                console.log(" Inside Range Flow");
                if(qual==='audio'){
                    console.log("Inside trim audio only");
                    res.header("Content-Disposition", `attachment;  filename=${videoName}.mp3`);    
                    const audio = ytdl(url, {filter: 'audioonly'});
                    // Start the ffmpeg child process for audio only with startTime and duration
                    const ffmpegProcess = cp.spawn(ffmpeg, [
                        // Remove ffmpeg's console spamming
                        '-loglevel', '0', '-hide_banner',

                        '-i', 'pipe:3',    // Splicing audio based on startRange and duration given by the user
                        '-ss', startRange,
                        '-t', duration,
                        '-c:v', 'copy',
                        '-c:a', 'copy',

                        '-reconnect', '1',
                        '-reconnect_streamed', '1',
                        '-reconnect_delay_max', '4',
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
                    audio.pipe(ffmpegProcess.stdio[3]);
                    ffmpegProcess.stdio[6].pipe(res);

                    ffmpegProcess.on('close', () => {
                        process.stdout.write('\n\n\n\n');
                        console.log('Trimmed audio separately and downloaded successfully');
                    });

                }else{
                    if((itagArr.includes(itagValues[qual])) || (itagArr.includes(itagValuesBoth[qual]))){ // Do only if requested format is available in YT
                        console.log("Video has required format");
                        if(itagArr.includes(itagValuesBoth[qual])){ //Both Videoandaudio available use ffmpeg for trimming
                            console.log("Inside trim audio & video single stream");
                            res.header("Content-Disposition", `attachment;  filename=${videoName}.mp4`);    
                            const video = ytdl(url, {quality:itagValuesBoth[qual]})
                            // Start the ffmpeg child process for available video itag with startTime and duration
                            const ffmpegProcess = cp.spawn(ffmpeg, [
                                // Remove ffmpeg's console spamming
                                '-loglevel', '0', '-hide_banner',
                                '-ss', startRange,
                                '-t', duration,
                                '-i', 'pipe:3',    // Splicing based on startRange and duration given by the user
                                '-c:v', 'copy',
                                '-c:a', 'copy',
        
                                '-reconnect', '1',
                                '-reconnect_streamed', '1',
                                '-reconnect_delay_max', '4',
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
                            video.pipe(ffmpegProcess.stdio[3]);
                            ffmpegProcess.stdio[6].pipe(res);

                            ffmpegProcess.on('close', () => {
                                process.stdout.write('\n\n\n\n');
                                console.log('Trimmed audio & video streams together and downloaded successfully');
                            });

                        }else{
                            console.log("Inside trim audio & video separate streams ");
                            /* TODO : trimming 2 streams and combining them for 1080p   */
                            
                            res.header("Content-Disposition", `attachment;  filename=${videoName}.mkv`);   
                            const video = ytdl(url, {quality:itagValues[qual],filter: 'videoonly'})
                            .on('progress', (_, downloaded, total) => {
                                tracker.video = { downloaded, total };
                              });
                            const audio = ytdl(url, { filter: 'audioonly', highWaterMark: 1<<25})
                            .on('progress', (_, downloaded, total) => {
                                tracker.audio = { downloaded, total };
                              });
                            const tracker = {
                                        audio: { downloaded: 0, total: Infinity },
                                        video: { downloaded: 0, total: Infinity },
                                        ffmpegaud: { frame: 0, speed: '0x', fps: 0 },
                                        ffmpegvid: { frame: 0, speed: '0x', fps: 0 }
                                    }
                           //const progressbar = setInterval(() => {console.log(tracker)},1000);
                            // Start the ffmpeg child process
                            const ffmpegAudio = cp.spawn(ffmpeg, [
                                // Remove ffmpeg's console spamming
                                '-loglevel', '0', '-hide_banner',
                                // audio offset
                                //'-itsoffset', '1.0',
                                '-ss', startRange,
                                '-t', duration,
                                '-i', 'pipe:3',

                                '-reconnect', '1',
                                '-reconnect_streamed', '1',
                                '-reconnect_delay_max', '4',
                                // Define output container
                                '-f', 'matroska', 'pipe:6',
                            ], {
                                windowsHide: true,
                                stdio: [
                                // Standard: stdin, stdout, stderr
                                'inherit', 'inherit', 'inherit',
                                // Custom: pipe:3, pipe:4, pipe:5, pipe:6
                                'pipe', 'pipe', 'pipe', 'pipe',
                                ],
                            });

                            const ffmpegVideo = cp.spawn(ffmpeg, [
                                // Remove ffmpeg's console spamming
                                '-loglevel', '0', '-hide_banner',

                                '-i', 'pipe:3',    // Splicing based on startRange and duration given by the user
                                '-ss', startRange,
                                '-t', duration,
                                '-c:v', 'copy',
                                '-c:a', 'copy', 

                                '-reconnect', '1',
                                '-reconnect_streamed', '1',
                                '-reconnect_delay_max', '4',
                                // Define output container
                                '-f', 'matroska', 'pipe:6',
                            ], {
                                windowsHide: true,
                                stdio: [
                                // Standard: stdin, stdout, stderr
                                'inherit', 'inherit', 'inherit',
                                // Custom: pipe:3, pipe:4, pipe:5, pipe:6
                                'pipe', 'pipe', 'pipe', 'pipe',
                                ],
                            });

                            
                            audio.pipe(ffmpegAudio.stdio[3]);
                            video.pipe(ffmpegVideo.stdio[3]);

                            ffmpegAudio.stdio[6].pipe(fs.createWriteStream('./out.mp3'));
                            ffmpegVideo.stdio[6].pipe(fs.createWriteStream('./out.mkv'));

                           ffmpegAudio.on('close', ()=>{
                            process.stdout.write('\n\n\n\n');
                            console.log('Audio File written succesfully');
                           });
                           ffmpegVideo.on('close', ()=>{
                            process.stdout.write('\n\n\n\n');
                            console.log('Video File written succesfully');
                           });
                           
                            /*ffmpegProcess.on('close', () => {
                                process.stdout.write('\n\n\n\n');
                                console.log('Trimmed audio & video streams separately and downloaded successfully');
                            });*/
                        }
                    }
                } 
            }  
            else{// User has not specified range go with the usual flow ffmpeg is only used during 1080p video audio merging
                if(qual==='audio'){
                    console.log("Inside no trim audio only");
                    res.header("Content-Disposition", `attachment;  filename=${videoName}.mp3`);    
                    ytdl(url, {filter: 'audioonly'}).pipe(res);
                }
                else{
                    if((itagArr.includes(itagValues[qual])) || (itagArr.includes(itagValuesBoth[qual]))){ // Do only if requested format is available in YT
                        if(itagArr.includes(itagValuesBoth[qual])){ //Both Videoandaudio available no need to combine using ffmpeg
                            console.log("Inside no trim audio & video single stream");
                            res.header("Content-Disposition", `attachment;  filename=${videoName}.mp4`);    
                            ytdl(url, {quality:itagValuesBoth[qual]}).pipe(res);
                        }else{
                            console.log("Inside no trim audio & video separate streams");
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
                                console.log('No Trim, audio and video separate streams downloaded successfully');
                            });
                        }
                    }
                    else{
                        console.log('Error in fetching video format: ',qual);
                        res.status(404).send('<p>The requested video format is not available, for further queries please contact admin</p><p><a href="http://ytdownload-app.herokuapp.com/">Redirect to downloader</a></p>');
                    }
                    
                }
            }  
    }catch(error){
        //alert('The requested video details could not be found, please contact admin :(')
        console.log('Error in fetching video:',error);
        res.status(404).send('<p>Could not find the requested video, please contact admin</p><p><a href="http://ytdownload-app.herokuapp.com/">Redirect to downloader</a></p>');
    }
});
