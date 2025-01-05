/*
Adele A million years ago "2qBmtZnPSQouvADmqaHKxk" doesn't get a response
*/


const xrapidapikey = getAPIKey();
if (!xrapidapikey) {
  alert('Add a xrapidapikey= parameter to the URL with the right key');
  // Finalize execution
  throw new Error("Stopping execution");  // Finalize execution
}
const xrapidapiurl = "https://spot" + "ify81.p.rapidapi.com/download_track?q="
const xrapidapihost = "spot" + "ify81.p.rapidapi.com"

function getAPIKey() {
	const params = new URLSearchParams(window.location.search);
  const xrapidapikey = params.get("xrapidapikey");
	if (xrapidapikey) {
		localStorage.setItem("xrapidapikey", xrapidapikey);
		return xrapidapikey;
	}
	const xrapidapikeylocalStorage = localStorage.getItem("xrapidapikey");
	if (xrapidapikeylocalStorage) {
		return xrapidapikeylocalStorage;
	}
}


async function getTrackDownloadURL(trackId){ 
    // return "https://samplelib.com/lib/preview/mp3/sample-3s.mp3";   // REMOVE HARDCODED URL
    const trackData = await getTrackDownloadData(trackId);
    const largestUrl = selectTrackDownloadURL(trackData);
    return largestUrl;
}

// Function to convert size with units to bytes
const convertToBytes = (size) => {
    const units = {
      B: 1,
      KiB: 1024,
      MiB: 1024 ** 2,
      GiB: 1024 ** 3,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3
    };
  
    const regex = /([\d.]+)\s*([A-Za-z]+)$/;
    const match = size.match(regex);
    if (!match) {
        console.error(`Could not match from value : ${size}`)
        return 0;
    }
    const [_, value, unit] = match;
    return parseFloat(value) * (units[unit] || 1);
  };

function selectTrackDownloadURL(trackData){
    if (trackData){
        if (!(trackData.hasOwnProperty('youtube'))) {
            console.log("Returned video data has no youtube field");
            return null;
        }
        if (!(trackData.youtube.hasOwnProperty('download'))) {
            console.log("Returned video data has no download field");
            return null;
        }    
        if ((trackData.youtube.download.hasOwnProperty('error'))) {
          console.log(`Returned video has an error: ${trackData.youtube.download.error}`);
          if ((trackData.hasOwnProperty('preview_url')) && (trackData.preview_url !== "")) {
              console.log("Returning preview instead")
              return trackData.preview_url;
          } else {
              return null;
          } 
        }          
        if (trackData.youtube.download.length == 0 ) {
            console.log("Returned video data has no download items");
            return null;
        }    
        let largest = { sizeInBytes: 0, url: null };
        trackData.youtube.download.forEach((item) => {
            const sizeInBytes = convertToBytes(item.size);
            if (sizeInBytes > largest.sizeInBytes) {
                largest = { sizeInBytes, url: item.url };
            }
        });
        return largest.url;
    } else {
        return null;
    }    
}

async function getTrackDownloadData(trackId){
    try {
        const response = await fetch(xrapidapiurl + trackId, {
            method: "GET",
            headers: { "X-RapidAPI-Key": xrapidapikey,
                       "X-RapidAPI-Host": xrapidapihost }
        });
        if (response.ok) {
            const responseData = await response.json(); // Parse the response as JSON
            return responseData;
        } else {
            console.log('Error exchanging code: ' + response.status + " " + response.statusText);
            return null;
        }

    } catch (error) {
        console.log('Error during the request: ' + error.message);
        return null;
    }
}

// Sample Data

const trackDownloadSampleResponse1 = {
    "uri": "musicapp:track:6lknMmJZALXxx7emwwZWLX",
    "id": "6lknMmJZALXxx7emwwZWLX",
    "name": "Frozen",
    "albumOfTrack": {
      "uri": "musicapp:album:2GAIUdfLIFtxDty42RowjE",
      "name": "Frozen",
      "coverArt": {
        "sources": [
          {
            "url": "https://i.scdn.co/image/ab67616d00001e024cef50f6a5d84d46ad9a4af1",
            "width": 300,
            "height": 300
          },
          {
            "url": "https://i.scdn.co/image/ab67616d000048514cef50f6a5d84d46ad9a4af1",
            "width": 64,
            "height": 64
          },
          {
            "url": "https://i.scdn.co/image/ab67616d0000b2734cef50f6a5d84d46ad9a4af1",
            "width": 640,
            "height": 640
          }
        ]
      },
      "id": "2GAIUdfLIFtxDty42RowjE"
    },
    "artists": {
      "items": [
        {
          "uri": "musicapp:artist:6tbjWDEIzxoDsBA1FuhfPW",
          "profile": {
            "name": "Madonna"
          }
        },
        {
          "uri": "musicapp:artist:3NR7hAacOhmcztWvD7vJfS",
          "profile": {
            "name": "Sickick"
          }
        }
      ]
    },
    "contentRating": {
      "label": "NONE"
    },
    "duration": {
      "totalMilliseconds": 120157
    },
    "playability": {
      "playable": true
    },
    "youtube": {
      "videoId": "L0MK7qz13bU",
      "duration": 243,
      "download": [
        {
          "url": "https://samplelib.com/lib/preview/mp3/sample-3s.mp3",
          "format": "audio/mp4",
          "duration": "242.741",
          "size": "912.85KiB"
        },
        {
          "url": "https://samplelib.com/lib/preview/mp3/sample-6s.mp3",
          "format": "audio/webm",
          "duration": "242.641",
          "size": "1.02MiB"
        },
        {
          "url": "https://samplelib.com/lib/preview/mp3/sample-9s.mp3",
          "format": "audio/mp4",
          "duration": "242.741",
          "size": "1.41MiB"
        }
      ]
    }
  }

const trackDownloadSampleResponse2 = {
    "album": {
      "album_type": "album",
      "artists": [
        {
          "external_urls": {
            "musicapp": "https://open.musicapp.com/artist/5gOJTI4TusSENizxhcG7jB"
          },
          "href": "https://api.musicapp.com/v1/artists/5gOJTI4TusSENizxhcG7jB",
          "id": "5gOJTI4TusSENizxhcG7jB",
          "name": "David Bisbal",
          "type": "artist",
          "uri": "musicapp:artist:5gOJTI4TusSENizxhcG7jB"
        }
      ],
      "available_markets": [
        "AR",
        "XK"
      ],
      "external_urls": {
        "musicapp": "https://open.musicapp.com/album/0N6EhZwUx9nXKFGWmYmOsU"
      },
      "href": "https://api.musicapp.com/v1/albums/0N6EhZwUx9nXKFGWmYmOsU",
      "id": "0N6EhZwUx9nXKFGWmYmOsU",
      "images": [
        {
          "url": "https://i.scdn.co/image/ab67616d0000b273cee698c432e3438c26d5a3ef",
          "width": 640,
          "height": 640
        },
        {
          "url": "https://i.scdn.co/image/ab67616d00001e02cee698c432e3438c26d5a3ef",
          "width": 300,
          "height": 300
        },
        {
          "url": "https://i.scdn.co/image/ab67616d00004851cee698c432e3438c26d5a3ef",
          "width": 64,
          "height": 64
        }
      ],
      "name": "Todo Es Posible En Navidad",
      "release_date": "2024-11-15",
      "release_date_precision": "day",
      "total_tracks": 10,
      "type": "album",
      "uri": "musicapp:album:0N6EhZwUx9nXKFGWmYmOsU"
    },
    "artists": [
      {
        "external_urls": {
          "musicapp": "https://open.musicapp.com/artist/5gOJTI4TusSENizxhcG7jB"
        },
        "href": "https://api.musicapp.com/v1/artists/5gOJTI4TusSENizxhcG7jB",
        "id": "5gOJTI4TusSENizxhcG7jB",
        "name": "David Bisbal",
        "type": "artist",
        "uri": "musicapp:artist:5gOJTI4TusSENizxhcG7jB"
      }
    ],
    "available_markets": [
      "AR",
      "XK"
    ],
    "disc_number": 1,
    "duration_ms": 172453,
    "explicit": false,
    "external_ids": {
      "isrc": "ESUM72401360"
    },
    "external_urls": {
      "musicapp": "https://open.musicapp.com/track/72hyBDzwE6Tye56FvqMkiY"
    },
    "href": "https://api.musicapp.com/v1/tracks/72hyBDzwE6Tye56FvqMkiY",
    "id": "72hyBDzwE6Tye56FvqMkiY",
    "is_local": false,
    "name": "El Burrito Sabanero",
    "popularity": 68,
    "preview_url": "https://p.scdn.co/mp3-preview/074b93511e125dfabc278f067044e6a032b24120?cid=d8a5ed958d274c2e8ee717e6a4b0971d",
    "track_number": 8,
    "type": "track",
    "uri": "musicapp:track:72hyBDzwE6Tye56FvqMkiY",
    "duration": {
      "seconds": 172.453
    },
    "youtube": {
      "videoId": "YucObHxl1Ko",
      "duration": 172,
      "download": [
        {
          "url": "https://trustpilot.digitalshopuy.com/musicapp-data/downloads/YucObHxl1Ko.m4a",
          "duration": 171.5025850340136,
          "size": "2.65 MB",
          "format": "MPEG-4/AAC"
        }
      ],
      "search_term": "El Burrito Sabanero David Bisbal"
    }
  }