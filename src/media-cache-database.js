// Function to open or create the IndexedDB database
async function getMediaDatabase(dbName, storeName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create the object store if it does not already exist
            if (!db.objectStoreNames.contains(storeName)) {
                const store = db.createObjectStore(storeName, { keyPath: 'track_id' }); // Default key path: 'id'
                store.createIndex('lastAccessed', 'lastAccessed', { unique: false }); // Index on lastAccessed
                console.log(`Store '${storeName}' created in database '${dbName}'`);
            } else {
                console.log(`Store '${storeName}' already exists in database '${dbName}'`);
            }
        };

        request.onsuccess = (event) => {
            const db = event.target.result;

            // Check if the store exists
            if (!db.objectStoreNames.contains(storeName)) {
                // Store doesn't exist, need to recreate the database with a higher version
                db.close();
                const version = db.version + 1;
                const upgradeRequest = indexedDB.open(dbName, version);

                upgradeRequest.onupgradeneeded = (upgradeEvent) => {
                    const upgradeDb = upgradeEvent.target.result;
                    upgradeDb.createObjectStore(storeName, { keyPath: 'track_id' });
                    store.createIndex('lastAccessed', 'lastAccessed', { unique: false }); // Index on lastAccessed
                    console.log(`Store '${storeName}' created during upgrade to version ${version}`);
                };

                upgradeRequest.onsuccess = (upgradeEvent) => {
                    const upgradedDb = upgradeEvent.target.result;
                    resolve(upgradedDb); // Return the database instance
                };

                upgradeRequest.onerror = (errorEvent) => {
                    reject(`Failed to upgrade database: ${errorEvent.target.error}`);
                };
            } else {
                resolve(db); // Store already exists, return the database instance
            }
        };

        request.onerror = (event) => {
            reject(`Failed to open database: ${event.target.error}`);
        };
    });
}

async function cacheMedia(db, storeName, track_id, blob) {
    return new Promise((resolve, reject) => {
        if (typeof track_id !== 'string' || !track_id) {
            reject('Invalid Track Id: Id must be a non-empty string');
            return;
        }
        try {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            const mediaData = {
                track_id: track_id,
                audioBlob: blob,
                lastAccessed: new Date().toISOString(),
            };

            console.log("Storing media data:", mediaData);

            const request = store.put(mediaData);

            request.onsuccess = () => {
                resolve(`Media with track_id '${track_id}' stored successfully`);
            };

            request.onerror = (event) => {
                reject(`Error storing media: ${event.target.error}`);
            };

            transaction.onerror = (event) => {
                reject(`Transaction error: ${event.target.error}`);
            };

            transaction.oncomplete = () => {
                console.log(`Transaction completed for track_id: '${track_id}'`);
            };
        } catch (error) {
            reject(`Unexpected error: ${error.message}`);
        }
    });
}

async function getCachedMedia(db, storeName, track_id) {
    return new Promise((resolve, reject) => {
        if (typeof track_id !== 'string' || !track_id) {
            reject('Invalid Track Id: Id must be a non-empty string');
            return;
        }

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        // Get the media data by track_id
        const request = store.get(track_id);

        request.onsuccess = (event) => {
            const result = event.target.result;
            if (result && result.audioBlob) {
                // Update lastAccessed timestamp
                result.lastAccessed = new Date().toISOString();
                const updateRequest = store.put(result); // Update the record with the new lastAccessed time

                updateRequest.onsuccess = () => {
                    resolve(result.audioBlob); // Return the Blob (audio/video file)
                };

                updateRequest.onerror = (event) => {
                    reject(`Error updating lastAccessed timestamp: ${event.target.error}`);
                };
            } else {
                resolve(null); // No media found for the given track_id
            }
        };

        request.onerror = (event) => {
            reject(`Error fetching cached media: ${event.target.error}`);
        };
    });
}

async function getIndexedDBStorageUsed(dbName, storeName) {
    // returns storage used in bytes
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            // Gather all records and calculate the database size
            const allRecords = [];
            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = (cursorEvent) => {
                const cursor = cursorEvent.target.result;
                if (cursor) {
                    allRecords.push(cursor.value);
                    cursor.continue();
                } else {
                    // Calculate the total size of all records
                    let totalSize = allRecords.reduce((sum, record) => {
                        return sum + (record.audioBlob?.size || 0);
                    }, 0);

                    console.log(`Current database size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
                    resolve(totalSize);
                }
            };

            cursorRequest.onerror = (cursorErrorEvent) => {
                reject(`Failed to iterate records: ${cursorErrorEvent.target.error}`);
            };
        };

        request.onerror = (event) => {
            reject(`Failed to open database: ${event.target.error}`);
        };
    });
}

async function manageMediaDatabaseSize(dbName, storeName, maxSizeMB) {
    // Deletes records until the size is less than the maxSizeMB passed
    const maxSizeBytes = maxSizeMB * 1024 * 1024; // Convert MB to bytes

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onsuccess = (event) => {
            const db = event.target.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            // Gather all records and calculate the database size
            const allRecords = [];
            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = (cursorEvent) => {
                const cursor = cursorEvent.target.result;
                if (cursor) {
                    allRecords.push(cursor.value);
                    cursor.continue();
                } else {
                    // Calculate the total size of all records
                    let totalSize = allRecords.reduce((sum, record) => {
                        return sum + (record.audioBlob?.size || 0);
                    }, 0);

                    // Sort records by lastAccessed (oldest first)
                    allRecords.sort((a, b) => new Date(a.lastAccessed) - new Date(b.lastAccessed));

                    // Delete records until the database size is below the limit
                    let deletedCount = 0;
                    while (totalSize > maxSizeBytes && allRecords.length > 0) {
                        const oldestRecord = allRecords.shift(); // Get the oldest record
                        const deleteRequest = store.delete(oldestRecord.track_id);

                        deleteRequest.onsuccess = () => {
                            console.log(`Deleted record with track_id: ${oldestRecord.track_id}`);
                        };

                        deleteRequest.onerror = (deleteErrorEvent) => {
                            console.error(`Failed to delete record: ${deleteErrorEvent.target.error}`);
                        };

                        totalSize -= oldestRecord.audioBlob?.size || 0;
                        deletedCount++;
                    }
                    console.log(`Database management completed with max: ${maxSizeMB} MB. ${deletedCount} records deleted.`);
                    // console.log(`Deleted ${deletedCount} records. Database size now: ${totalSize} bytes`);
                    resolve(deletedCount);
                }
            };

            cursorRequest.onerror = (cursorErrorEvent) => {
                reject(`Failed to iterate records: ${cursorErrorEvent.target.error}`);
            };
        };

        request.onerror = (event) => {
            reject(`Failed to open database: ${event.target.error}`);
        };
    });
}

function clearObjectStore(dbName, storeName) {
    // Clear all records from the database without deleting the entire database
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
    
            request.onsuccess = event => {
                const db = event.target.result;
                const transaction = db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const clearRequest = store.clear();
    
                clearRequest.onsuccess = () => {
                    console.log(`Object store ${storeName} cleared successfully`);
                    resolve();
                };
    
                clearRequest.onerror = event => {
                    console.error(`Failed to clear object store ${storeName}:`, event.target.errorCode);
                    reject(event.target.errorCode);
                };
            };
    
            request.onerror = event => {
                console.error(`Failed to open database ${dbName}:`, event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
}

function mediaCacheDatabaseCheck() {
    // quick check to see if the module is loaded
    return('Hello World!');
}

function deleteMediaDatabaseOldRecords(db, storeName, noDays) {
    // Function to delete records that haven't been accessed in the last noDays
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index('lastAccessed');
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getDate() - noDays);
    
            const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
            const request = index.openCursor(range);
    
            let counter = 0;

            request.onsuccess = event => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    console.log(`Deleted item ${cursor.primaryKey}`);
                    counter++;
                    cursor.continue();
                } else {
                    resolve(counter);
                }
            };
    
            request.onerror = event => reject(`Error deleting old records: ${event.target.errorCode}`);
        });
}

async function cleanupOldRecords(db, storeName) {
// Example usage to delete old records
    try {
        await deleteMediaDatabaseOldRecords(db, storeName, 90);
        console.log('Old records cleaned up successfully.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

function deleteDatabase(dbName) {
    // Deletes the entire database
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
    
            request.onsuccess = () => {
                console.log(`Database ${dbName} deleted successfully`);
                resolve();
            };
    
            request.onerror = event => {
                console.error(`Failed to delete database ${dbName}:`, event.target.errorCode);
                reject(event.target.errorCode);
            };
    
            request.onblocked = () => {
                console.warn(`Deletion of database ${dbName} is blocked`);
                reject('Deletion blocked');
            };
        });
}

// archive

async function loadVideo() {
    // read the url and track_id from document
    const trackId = document.getElementById("track-id").value;
    const inputURL = document.getElementById("input-url").value;
    console.log(`Loading track ${trackId}`);
    try {
        const db = await openDatabase();
        let audioBlob  = await getCachedMedia(db, trackId);

        if (!audioBlob ) {
            console.log('Audio not cached, fetching from network...');
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
            audioBlob  = await response.blob();
            cacheMedia(db, trackId, audioBlob);  // I don't make this call with await to do it asyncronously
            console.log('Fetched and cached media');
        } else {
            console.log('Loaded media from cache');
        }

        const audioURL  = URL.createObjectURL(audioBlob);
        
        const videoPlayer = document.getElementById('videoPlayer');
        videoPlayer.src = audioURL;
        videoPlayer.play();
    } catch (error) {
        console.error('Error loading video:', error);
    }
}
