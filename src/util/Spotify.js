const CLIENT_ID = '0df2bda6cb8f4f928cef2b5b855a5154';
const REDIRECT_URI = 'http://localhost:3000/';

let accessToken;

var Spotify = {
  getAccessToken() {
    if (accessToken) {
      return accessToken;
    }

    const token = window.location.href.match(/access_token=([^&]*)/);
    const expiry = window.location.href.match(/expires_in=([^&]*)/);

    if (token && expiry) {
      accessToken = token[1];
      let expiresIn = expiry[1];
      window.setTimeout(() => accessToken = null, expiresIn * 1000);
      window.history.pushState('Access Token', null, '/');
      return accessToken;
    }

    window.location = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&scope=playlist-modify-public&redirect_uri=${REDIRECT_URI}`;
  },

  search(term) {
    this.getAccessToken();

    return fetch(
      `https://api.spotify.com/v1/search?type=track&q=${term}`,
      {headers: {Authorization: `Bearer ${accessToken}`}})
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Request failed!');
    }, networkError => console.log(networkError.message))
    .then(jsonResponse => {
      if (jsonResponse.tracks.items) {
        return jsonResponse.tracks.items.map(item => {
          return {
            id: item.id,
            name: item.name,
            artist: item.artists.map(artist => artist.name).join(', '),
            album: item.album.name,
            uri: item.uri
          };
        });
      } else {
        return [];
      }
    });
  },

  // Added functionality - If the playlist already exists, added missing tracks
  // it, instead of creating a duplicate playlist.
  savePlaylist(playlist_name, track_uris) {
    this.getAccessToken();

    if (!playlist_name || !track_uris) {
      return;
    }

    let access_token = accessToken;
    let headers = {Authorization: `Bearer ${access_token}`};
    let userId;

    fetch(
      'https://api.spotify.com/v1/me',
      {headers: headers})
    .then(response => {
      if (response.ok) {
        return response.json()
      }
      throw new Error('Request failed!');
    }, networkError => console.log(networkError.message))
    .then(jsonResponse => {
      // Get userId
        userId = jsonResponse.id;

        let playlistId;
        fetch(
          `https://api.spotify.com/v1/users/${userId}/playlists/`,
          {headers: headers})
        .then(response => {
          if (response.ok) {
            return response.json()
          }
          throw new Error('Request failed!');
        }, networkError => console.log(networkError.message))
        .then(jsonResponse => {
          // Get existing playlists
          let existingPlaylist = jsonResponse.items.find(playlist => playlist.name === playlist_name);

          if (existingPlaylist) {
            // if playlist exists, add to it.
            playlistId = existingPlaylist.id;

            fetch(
              `https://api.spotify.com/v1/users/${userId}/playlists/${playlistId}/tracks`,
              {headers: headers})
            .then(response => {
              if (response.ok) {
                return response.json()
              }
              throw new Error('Request failed!');
            }, networkError => console.log(networkError.message))
            .then(jsonResponse => {
              // find existing songs and don't add them again
              let existingUris = jsonResponse.items.map(item => item.track.uri);
              let tracksToAddUris = track_uris.filter(uri => !existingUris.includes(uri));

              fetch(
                `https://api.spotify.com/v1/users/${userId}/playlists/${playlistId}/tracks`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-type': 'application/json',
                  },
                  body: JSON.stringify({
                    uris: tracksToAddUris
                  })
                })
              .then(response => {
                if (response.ok) {
                  return response.json()
                }throw new Error('Request failed!');
              }, networkError => console.log(networkError.message))
              .then(jsonResponse => {
              playlistId = jsonResponse.snapshot_id;
            })
          })
          } else {
            // Create a new playlist and add tracks
            fetch(
              `https://api.spotify.com/v1/users/${userId}/playlists/`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-type': 'application/json',
                },
                body: JSON.stringify({
                  name: playlist_name
                })
              })
            .then(response => {
              if (response.ok) {
                return response.json()
              }
              throw new Error('Request failed!');
            }, networkError => console.log(networkError.message))
            .then(jsonResponse => {
              playlistId = jsonResponse.id;
              fetch(
                `https://api.spotify.com/v1/users/${userId}/playlists/${playlistId}/tracks`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-type': 'application/json',
                  },
                  body: JSON.stringify({
                    uris: track_uris
                  })
                })
              .then(response => {
                if (response.ok) {
                  return response.json()
                }
                throw new Error('Request failed!');
              }, networkError => console.log(networkError.message))
              .then(jsonResponse => {
                playlistId = jsonResponse.id;
              })
            })
          }
        })
    })

  }
}

export default Spotify;
