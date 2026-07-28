// Polyfill ES2024 Promise.withResolvers for Safari, Mobile WebViews & older Chrome
if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// Polyfill Array.prototype.at for older desktop/mobile browsers (Windows 7 Chrome/Safari)
if (!Array.prototype.at) {
  Array.prototype.at = function (n) {
    n = Math.trunc(n) || 0
    if (n < 0) n += this.length
    if (n < 0 || n >= this.length) return undefined
    return this[n]
  }
}

// Polyfill Object.hasOwn
if (!Object.hasOwn) {
  Object.hasOwn = function (obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop)
  }
}

// Polyfill globalThis
if (typeof globalThis === 'undefined') {
  (function () {
    if (typeof self !== 'undefined') { self.globalThis = self }
    else if (typeof window !== 'undefined') { window.globalThis = window }
    else if (typeof global !== 'undefined') { global.globalThis = global }
  })()
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
