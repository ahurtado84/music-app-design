// To use this module:
// <script src="music-app-api-script.js"></script>
//
// To-do list:
//
// Done, limits in API calls!
// Done, limit what I get in tracks specially &fields=items(track(!available_markets,album(!available_markets)))
// To do, there is a preview video, to use video_thumbnail
// Done, start caching stuff

const musicAppAPIMode = "prod"  // dry-run or prod
const musicAppScope = "playlist-modify-private playlist-modify-public user-read-private playlist-read-private user-read-email";
const accountsBaseURL = "https://accounts.spot" + "ify.com"
const apiBaseURL = "https://api.spot" + "ify.com"

let urlObj = new URL(window.location.href);
// Set the redirectURI to the current page without parameters
let musicAppRedirectURI = urlObj.origin + urlObj.pathname;

const params = new URLSearchParams(window.location.search);
const codeParam = params.get("code");
const clientId = getClientID();
const clientSecret = getClientSecret();

if (musicAppAPIMode != 'dry-run'){
    if (!clientId || !clientSecret) {
        alert('Add a clientId= and clientSecret= to the URL');
        // Finalize execution
        throw new Error("Stopping execution");  // Finalize execution
    }

    const savedCode = sessionStorage.getItem('code');
    if (!codeParam) {
        redirectToAuthCodeFlow(clientId);
    }
    else {
      sessionStorage.setItem('code', codeParam);
      if (!savedCode) {
        redirectToAuthCodeFlow(clientId);
      }
    }
}


function getClientID() {
	const clientIdParam = params.get("clientId");
	if (clientIdParam) {
		localStorage.setItem("clientId", clientIdParam);
		return clientIdParam;
	}
	const clientIdlocalStorage = localStorage.getItem("clientId");
	if (clientIdlocalStorage) {
		return clientIdlocalStorage;
	}
}

function getClientSecret() {
	const clientSecretParam = params.get("clientSecret");
	if (clientSecretParam) {
		localStorage.setItem("clientSecret", clientSecretParam);
		return clientSecretParam;
	}
	const clientSecretlocalStorage = localStorage.getItem("clientSecret");
	if (clientSecretlocalStorage) {
		return clientSecretlocalStorage;
	}
}

async function getMusicAppAccessToken() {
    if (musicAppAPIMode=='dry-run'){
        return 'dummyToken';  // Finalize execution
    }
    
    const accessCode = sessionStorage.getItem("code");
    if (!accessCode) {
      console.error("No available access code");
      return;
    }

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", accessCode);
    params.append("redirect_uri", musicAppRedirectURI);
    params.append("client_secret", clientSecret);

    // ensure that code is only used ONCE
    sessionStorage.removeItem("code");

    try {
        const response = await fetch(accountsBaseURL + "/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });
        if (response.ok) {
            const responseData = await response.json(); // Parse the response as JSON
            return responseData.access_token;
        } else {
            console.error('Error exchanging code: ' + response.status + " " + response.statusText);
        }

    } catch (error) {
        console.log('Error during the request: ' + error.message);
    }
}

async function fetchMusicAppProfile(token) {
    if (musicAppAPIMode=='dry-run'){
        return loadJsonFile('../files/profile.json');  // Finalize execution
    }

    const endpoint = apiBaseURL + "/v1/me";

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching profile: ${response.statusText}`);
        }

        const data = await response.json();
        return data; 
    } catch (error) {
        console.error('Error fetching MusicApp profile:', error);
        return null;
    }
}

async function fetchMusicAppPlaylists(token, userId) {
    if (musicAppAPIMode=='dry-run'){
        return loadJsonFile('../files/playlists.json');  // Finalize execution
    }

    const endpoint = `${apiBaseURL}/v1/users/${userId}/playlists?limit=50`;

    return fetchMusicAppList(token, userId + '-spot'+ 'ify-playlists', endpoint, 'playlists');
}

async function fetchMusicAppPlaylistTracks(token, playlistId) {
  if (musicAppAPIMode=='dry-run'){
      return loadJsonFile('../files/tracks.json');  // Finalize execution
  }
  const fields = 'fields=next,items(track(preview_url,name,id,album(name,images),artists(name)),video_thumbnail)'
  var endpoint = `${apiBaseURL}/v1/playlists/${playlistId}/tracks?${fields}&limit=50`;
  
  return fetchMusicAppList(token, playlistId, endpoint, 'tracks');
}

async function fetchMusicAppList(token, id, endpoint, object_type){
  // Retrieving cached data
  const cachedData = sessionStorage.getItem(id);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  var items = [];
  try {
        while (endpoint) {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error fetching ${object_type}: ${response.statusText}`);
            }

            const data = await response.json();
            if ('items' in data) {
                items = items.concat(data.items);
            } else {
                console.error(`Error fetching MusicApp ${object_type}, data has no items`);
            }
            endpoint = data.next;  // send endpoint to the URL for the next batch, null when done
        }
        // Caching data
        sessionStorage.setItem(id, JSON.stringify(items));
        return items;
  } catch (error) {
      console.error('Error fetching MusicApp ',object_type, error);
      return null;
  }  
}

async function searchMusicApp(token, searchCriteria) {
  if (musicAppAPIMode=='dry-run'){
    return sampleTracks;  // Finalize execution
  }
  if (searchCriteria==''){
    return null;  // Finalize execution
  }

  var endpoint = `${apiBaseURL}/v1/search?query=${encodeURIComponent(searchCriteria)}&type=track&limit=50`;
  var items = [];
  try {
    // In this case I'm not calling next as results could be thousands, take the first 50 only
      const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
          }
      });

      if (!response.ok) {
          throw new Error(`Error fetching: ${response.statusText}`);
      }

      const data = await response.json();
      if ('tracks' in data) {
          items = items.concat(data.tracks.items);
      } else {
          console.error(`Error fetching MusicApp, data has no tracks`);
      }

  return items;
  } catch (error) {
      console.error(`Error fetching: ${error}`);
      return null;
  }  

}

async function addPlaylistItems(token, playlistId, trackList) {
    // Validate playlistId
    if (typeof playlistId !== 'string' || !playlistId.trim()) {
        throw new Error("Invalid playlistId: it must be a non-empty string.");
    }

    // Validate trackList
    if (!Array.isArray(trackList)) {
        throw new Error("Invalid trackList: it must be an array.");
    }
    if (!trackList.every(item => typeof item === 'string' && item.trim())) {
        throw new Error("Invalid trackList: all elements must be non-empty strings.");
    }
    
    var endpoint = `${apiBaseURL}/v1/playlists/${playlistId}/tracks`;
    var items = [];
    const payload = {
        uris: trackList.map(id => (`spotify:track:${id}`))
    };
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Error adding track from playlist: ${response.statusText}`);
        }

        const data = await response.json();
        return true; 
    } catch (error) {
        console.error('Error adding track from playlist:', error);
        return false;
    }
}

async function removePlaylistItems(token, playlistId, trackList) {
    // Validate playlistId
    if (typeof playlistId !== 'string' || !playlistId.trim()) {
        throw new Error("Invalid playlistId: it must be a non-empty string.");
    }

    // Validate trackList
    if (!Array.isArray(trackList)) {
        throw new Error("Invalid trackList: it must be an array.");
    }
    if (!trackList.every(item => typeof item === 'string' && item.trim())) {
        throw new Error("Invalid trackList: all elements must be non-empty strings.");
    }
    
    var endpoint = `${apiBaseURL}/v1/playlists/${playlistId}/tracks`;
    var items = [];
    const payload = {
        tracks: trackList.map(id => ({ uri: `spotify:track:${id}` }))
    };
    try {
        const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Error removing track from playlist: ${response.statusText}`);
        }

        const data = await response.json();
        return true; 
    } catch (error) {
        console.error('Error removing track from playlist:', error);
        return false;
    }
}

// Code refresh functions

async function redirectToAuthCodeFlow(clientId) {
    // const verifier = generateCodeVerifier(128);
    // const challenge = await generateCodeChallenge(verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", musicAppRedirectURI);
    params.append("scope", musicAppScope);
    params.append("state",generateRandomString(16));

    document.location = `${accountsBaseURL}/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Helper generic functions

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
  
    return text;
}

function getRandomFromList(list) {
  return list[Math.floor((Math.random()*list.length))];
}

function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

async function loadJsonFile(fileLoc) {
  try {
    const response = await fetch(fileLoc);
    if (!response.ok) {
      throw new Error(`Failed to load JSON: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading JSON file:', error);
    return null;
  }
}

// Archive 

async function fetchTrack(inputURL){
  // Define the payload with the URL parameter
  const payload = {
    url: inputURL 
};
const response = await fetch('http://127.0.0.1:5000/get_audio', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
});
let audioBlob  = await response.blob();
return audioBlob;
}