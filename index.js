const express = require('express');
//const fs = require('fs');
const cp = require('child_process');
const ytdl = require('ytdl-core');
const ffmpeg = require('ffmpeg-static');
let path = require('path');

const app = express();
let hostname = "localhost:9999";
app.use('/static', express.static('./static'));
app.use(express.static(path.join(__dirname, 'public')));

let server = app.listen((process.env.PORT || 9999),()=>{
    console.log(`Server started at http://${hostname}/`);
});
//server.setTimeout(600000);
app.get('/', (req, res) => { 
    hostname = req.headers.host;
    console.log("Hostname: ",hostname);
    res.sendFile('index.html',{ root: './' });
});


redirectPage = '<head><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300&display=swap" rel="stylesheet"></head><title>Error - Viki\'s Youtube Downloader</title><img class="myGif" src="https://i.pinimg.com/originals/e8/2d/d7/e82dd7c3a8d4fbaba85e136701770d8d.gif"><style> img { display: block; margin: 0 auto;} p { text-align: center; font-family: \'Open Sans\',serif;} </style>';
//Adding Easter Eggs 🥚

redirectLink = `<p><a href="https://${process.env.RENDER_EXTERNAL_HOSTNAME}/">Redirect to downloader</a></p>`;

function validateTimeRange(time){
    let regexMinSec = /^([0-5][0-9]):([0-5][0-9])$/g;
    let regexHrMinSec = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/g;

    if(time.match(regexHrMinSec))
        return true;
    else if(time.match(regexMinSec))
        return true;
    else
        return false;
}

function calculateDuration(startRange, endRange){
    let timeArr1, timeArr2, diff, date, duration, startSeconds, endSeconds;

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
                res.status(404).send(redirectPage+'<p>The range values specified is invalid, also please check : char in time as in youtube video timeline</p>'+redirectLink);
        }
        diff = endSeconds - startSeconds;
        console.log(" Time Difference :",diff);
        date = new Date(0);
        date.setSeconds(diff);
        duration = date.toISOString().substr(11, 8);
        console.log("Time Duration : ",duration);

        return duration;
    }
    
}

app.get('/download', async (req, res)=>{
    try{
            let itagValues = {'360p':134, '480p':135,'720p':136, '1080p':137, '1080p60':299}; //itag values video only
            let itagValuesBoth = {'360p':18, '480p':35,'720p':22, '1080p':37}; //itag values audio and video both
            let url = req.query.ytLink;
            let startRange = req.query.startRange;
            let endRange = req.query.endRange;
            let qual = req.query.format;
            let duration = 0, totalDuration;
            if(qual===undefined){
                qual = '720p'; // Default resolution set to 720p, if no value given by user
            }
            
            console.log("Range : ",startRange," - ",endRange);
            //console.log("Trim : ",startRange," ",endRange);
            if((validateTimeRange(startRange) && validateTimeRange(endRange)))
                //Calculate time duration only if range specified by user
                duration = calculateDuration(startRange,endRange);

            let content_name = await ytdl.getInfo(url);
            totalDuration = content_name.videoDetails.lengthSeconds
            console.log("Total duration ", totalDuration);
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
            if((validateTimeRange(startRange) && validateTimeRange(endRange) && (duration<=totalDuration))){ //When user specified startRange or endRange trim the video using ffmpeg before piping to res
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
                            // TODO : trimming 2 streams and combining them for 1080p
                            res.status(404).send(redirectPage+'<p>Currently trimming 2 separate streams (Eg: Audio/Video) is not supported, Please try lower resolutions; For further queries please contact admin</p>'+redirectLink);
                           /* res.header("Content-Disposition", `attachment;  filename=${videoName}.mkv`);   
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

                           ffmpegAudio.on('close', ()=>{
                            process.stdout.write('\n\n\n\n');
                            console.log('Audio File written succesfully');
                           });
                           ffmpegVideo.on('close', ()=>{
                            
                            process.stdout.write('\n\n\n\n');
                            console.log('Video File written succesfully');
                            
                           });
                            const ffmpegProcess = cp.spawn(ffmpeg, [
                                // Remove ffmpeg's console spamming
                                '-loglevel', '0', '-hide_banner',
                                '-ss', startRange,
                                '-t', duration,
                                '-i', 'pipe:3',
                                '-i', 'pipe:4',
                                '-ss', startRange,
                                '-t', duration,
                                '-c:v', 'copy',
                                '-c:a', 'copy', 
                            
                                '-reconnect', '1',
                                '-reconnect_streamed', '1',
                                '-reconnect_delay_max', '4',
                                '-shortest',
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
                            audio.pipe(ffmpegProcess.stdio[3]);
                            video.pipe(ffmpegProcess.stdio[4]);

                            ffmpegProcess.stdio[6].pipe(res);
                            ffmpegProcess.on('close', () => {
                                process.stdout.write('\n\n\n\n');
                                console.log('Trimmed audio & video streams separately and downloaded successfully');
                            });*/
                           
                        }
                    }
                } 
            }  
            else if( startRange==='' || endRange==='' ){// User has not specified range go with the usual flow ffmpeg is only used during 1080p video audio merging
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
                        res.status(404).send(redirectPage+'<p>The requested video format is not available, for further queries please contact admin</p>'+redirectLink);
                    }
                    
                }
            }
            else{
                console.log("Since not a valid startRange or endRange aborting");
                res.status(404).send(redirectPage+'<p>Please specify a valid time range</p>'+redirectLink);
            }  
    }catch(error){
        //alert('The requested video details could not be found, please contact admin :(')
        console.log('Error in fetching video:',error);
        res.status(404).send(redirectPage+'<p>Could not find the requested video, please contact admin</p>'+redirectLink);
    }
});
