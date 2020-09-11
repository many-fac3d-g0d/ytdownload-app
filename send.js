
function sendLink(){
    var downloadButton = document.getElementById('downloadButton');
    var ytLink = document.getElementById('ytLink').value;
    console.log(`SEND URL : ${ytLink}`);
    sendURL(ytLink);
})

function sendURL(URL) {
    fetch(`http://localhost:9999/download?URL=${URL}`, {
        method:'GET'
    }).then(res => res.json())
    .then(json => console.log(json));
}
