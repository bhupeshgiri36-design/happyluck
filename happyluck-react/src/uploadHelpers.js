import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient'

/**
 * Uploads a file to Supabase Storage with real progress updates.
 *
 * supabase-js's normal `.storage.from(bucket).upload()` uses fetch(), and
 * fetch() gives no upload-progress events in the browser — that's why the
 * old code looked "stuck" on slow connections. XMLHttpRequest DOES expose
 * upload progress, so we call the Storage REST endpoint directly with XHR.
 *
 * @param {string} bucket   Storage bucket name, e.g. 'recordings-audio'
 * @param {string} path     Destination path/filename inside the bucket
 * @param {File}   file     The File object from an <input type="file">
 * @param {(pct:number)=>void} onProgress  Called with 0–100 as upload proceeds
 * @returns {Promise<{path:string}>}
 */
export async function uploadFileWithProgress(bucket, path, file, onProgress) {
  // Use the logged-in user's session token if there is one, otherwise fall
  // back to the public anon key (matches how supabase-js authorizes requests).
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token || SUPABASE_ANON_KEY

  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path)}`

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress && onProgress(100)
        resolve({ path })
      } else {
        let message = xhr.responseText
        try {
          message = JSON.parse(xhr.responseText).message || message
        } catch {
          // leave message as raw text
        }
        reject(new Error(`Upload failed (${xhr.status}): ${message}`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload — check your connection and try again.'))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))

    xhr.send(file)
  })
}
