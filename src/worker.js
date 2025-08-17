addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // If accessing the root, show the interface
  if (url.pathname === '/') {
    return new Response(getInterface(), {
      headers: { 'Content-Type': 'text/html' }
    })
  }
  
  // Extract the target URL from the path
  const targetUrl = url.pathname.slice(1) // Remove leading slash
  
  if (!targetUrl) {
    return new Response('No URL provided', { status: 400 })
  }
  
  let decodedUrl
  try {
    decodedUrl = decodeURIComponent(targetUrl)
  } catch (e) {
    return new Response('Invalid URL encoding', { status: 400 })
  }
  
  // Validate URL
  if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
    return new Response('Invalid URL - must start with http:// or https://', { status: 400 })
  }
  
  try {
    return await proxyDownload(request, decodedUrl)
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(`Proxy error: ${error.message}`, { status: 500 })
  }
}

async function proxyDownload(originalRequest, targetUrl) {
  // Create headers for the upstream request
  const upstreamHeaders = new Headers()
  
  // Copy relevant headers from the original request
  const relevantHeaders = [
    'range',
    'user-agent',
    'accept',
    'accept-encoding',
    'cache-control',
    'if-modified-since',
    'if-none-match'
  ]
  
  relevantHeaders.forEach(header => {
    const value = originalRequest.headers.get(header)
    if (value) {
      upstreamHeaders.set(header, value)
    }
  })
  
  // Add custom headers for better compatibility
  upstreamHeaders.set('User-Agent', 'Cloudflare-Download-Link-Stabilizer/1.0')
  
  const upstreamRequest = new Request(targetUrl, {
    method: originalRequest.method,
    headers: upstreamHeaders,
    // Don't forward body for GET requests
    body: originalRequest.method !== 'GET' ? originalRequest.body : null
  })
  
  // Fetch with timeout and retry logic
  const response = await fetchWithRetry(upstreamRequest, 3)
  
  if (!response.ok && response.status !== 206) {
    throw new Error(`Upstream server responded with ${response.status}: ${response.statusText}`)
  }
  
  // Create response headers
  const responseHeaders = new Headers()
  
  // Copy important headers from upstream response
  const importantHeaders = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
    'cache-control',
    'expires'
  ]
  
  importantHeaders.forEach(header => {
    const value = response.headers.get(header)
    if (value) {
      responseHeaders.set(header, value)
    }
  })
  
  // Ensure range requests are supported
  if (!responseHeaders.has('accept-ranges')) {
    responseHeaders.set('accept-ranges', 'bytes')
  }
  
  // Extract and set the filename from the original URL
  const filename = extractFilename(targetUrl)
  if (filename) {
    responseHeaders.set('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
  }
  
  // Add CORS headers for browser compatibility
  responseHeaders.set('Access-Control-Allow-Origin', '*')
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type')
  responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition')
  
  // Handle OPTIONS requests for CORS
  if (originalRequest.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: responseHeaders
    })
  }
  
  // Create the response with the proxied body
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  })
}

async function fetchWithRetry(request, maxRetries) {
  let lastError
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      // Clone the request for each attempt
      const requestClone = request.clone()
      
      const response = await fetch(requestClone, {
        // Set timeout to prevent hanging
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })
      
      return response
    } catch (error) {
      lastError = error
      
      if (i < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
      }
    }
  }
  
  throw lastError
}

function extractFilename(url) {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    
    // Get the last segment of the path
    const segments = pathname.split('/').filter(segment => segment.length > 0)
    let filename = segments[segments.length - 1]
    
    // If no filename in path, try to extract from query parameters
    if (!filename || !filename.includes('.')) {
      const params = urlObj.searchParams
      // Check common query parameters that might contain filename
      const filenameParams = ['filename', 'file', 'name', 'download']
      for (const param of filenameParams) {
        const paramValue = params.get(param)
        if (paramValue && paramValue.includes('.')) {
          filename = paramValue
          break
        }
      }
    }
    
    // Clean the filename - remove any invalid characters
    if (filename) {
      filename = filename.replace(/[<>:"/\\|?*]/g, '_')
      // Decode URL encoded characters
      filename = decodeURIComponent(filename)
    }
    
    // If still no valid filename, generate one based on URL
    if (!filename || !filename.includes('.')) {
      const hostname = urlObj.hostname.replace(/[^a-zA-Z0-9.-]/g, '_')
      filename = `download_${hostname}_${Date.now()}`
    }
    
    return filename
  } catch (error) {
    console.error('Error extracting filename:', error)
    return `download_${Date.now()}`
  }
}

function getInterface() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloudflare Download Link Stabilizer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 {
            text-align: center;
            margin-bottom: 10px;
            font-size: 2.5em;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            text-align: center;
            margin-bottom: 40px;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .form-group {
            margin-bottom: 25px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 1.1em;
        }
        input[type="url"] {
            width: 100%;
            padding: 15px 20px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            font-size: 16px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            backdrop-filter: blur(5px);
            transition: all 0.3s ease;
            box-sizing: border-box;
        }
        input[type="url"]:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.5);
            background: rgba(255, 255, 255, 0.15);
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        }
        input[type="url"]::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }
        .button-group {
            display: flex;
            gap: 15px;
            margin-top: 30px;
        }
        button {
            flex: 1;
            padding: 15px 30px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .btn-primary {
            background: linear-gradient(45deg, #ff6b6b, #ee5a52);
            color: white;
            box-shadow: 0 4px 15px rgba(255, 107, 107, 0.3);
        }
        .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.4);
        }
        .btn-secondary {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 2px solid rgba(255, 255, 255, 0.3);
        }
        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        .result {
            margin-top: 30px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            border-left: 4px solid #4ecdc4;
            display: none;
        }
        .result.show {
            display: block;
            animation: slideIn 0.5s ease;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .proxy-url {
            word-break: break-all;
            background: rgba(0, 0, 0, 0.3);
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            margin: 10px 0;
        }
        .copy-btn {
            background: #4ecdc4;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            margin-top: 10px;
            transition: all 0.2s ease;
        }
        .copy-btn:hover {
            background: #45b7aa;
        }
        .features {
            margin-top: 40px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        .feature {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .feature-icon {
            font-size: 2em;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>⚡ Cloudflare Download Link Stabilizer</h1>
        <p class="subtitle">Transform slow and unstable download links into high-speed, reliable connections</p>
        
        <form id="proxyForm">
            <div class="form-group">
                <label for="downloadUrl">Enter Download URL:</label>
                <input type="url" 
                       id="downloadUrl" 
                       placeholder="https://example.com/slow-download-link.mp4" 
                       required>
            </div>
            
            <div class="button-group">
                <button type="submit" class="btn-primary">🚀 Stabilize Download Link</button>
                <button type="button" class="btn-secondary" onclick="clearForm()">🔄 Clear</button>
            </div>
        </form>

        <div id="result" class="result">
            <h3>✅ Stabilized Download URL Generated!</h3>
            <p>Use this enhanced URL for stable, high-speed downloads:</p>
            <div class="proxy-url" id="proxyUrl"></div>
            <button class="copy-btn" onclick="copyToClipboard()">📋 Copy URL</button>
            <p><small>This URL supports range requests for multithreaded downloads and provides automatic retry on failures.</small></p>
        </div>

        <div class="features">
            <div class="feature">
                <div class="feature-icon">⚡</div>
                <h3>Speed Boost</h3>
                <p>Optimized routing through Cloudflare's global network</p>
            </div>
            <div class="feature">
                <div class="feature-icon">🔄</div>
                <h3>Auto Retry</h3>
                <p>Automatic retries on connection failures</p>
            </div>
            <div class="feature">
                <div class="feature-icon">📊</div>
                <h3>Range Support</h3>
                <p>Full support for multithreaded downloads</p>
            </div>
        </div>
    </div>

    <script>
        document.getElementById('proxyForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const downloadUrl = document.getElementById('downloadUrl').value;
            const baseUrl = window.location.origin;
            const encodedUrl = encodeURIComponent(downloadUrl);
            const proxyUrl = baseUrl + '/' + encodedUrl;
            
            document.getElementById('proxyUrl').textContent = proxyUrl;
            document.getElementById('result').classList.add('show');
            
            // Scroll to result
            document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
        });

        function copyToClipboard() {
            const proxyUrl = document.getElementById('proxyUrl').textContent;
            navigator.clipboard.writeText(proxyUrl).then(function() {
                const btn = document.querySelector('.copy-btn');
                const originalText = btn.textContent;
                btn.textContent = '✅ Copied!';
                setTimeout(() => {
                    btn.textContent = originalText;
                }, 2000);
            }).catch(function(err) {
                console.error('Could not copy text: ', err);
            });
        }

        function clearForm() {
            document.getElementById('downloadUrl').value = '';
            document.getElementById('result').classList.remove('show');
        }
    </script>
</body>
</html>`
}
