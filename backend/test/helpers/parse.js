'use strict';

exports.emailVerify = function(data) {
  // harvesting the verification URL from the email payload
  console.log(data)
  let url = data.substring(data.indexOf('href=3D'), data.indexOf('">'))
  url = url.split('\r\n')
  url = url.map(function(line) {
    // hack to amend malformed URL from mail interception
    if (line.length == 76 && line.charAt(75) == '=') {
      line = line.substring(0, line.length -1)
    }
    return line
  })
  url = url.join('')
  url = url.substring(
    url.indexOf('http')).trim().replace(/[\n\r]/g, '');
  // handling for messy URL appearance from the email interception
  // if there is a better approach for this, then feel free to commit a fix
  url = decodeURIComponent(url)
  url = url.replace(/=3D/g, '=').replace(/&amp;/g, '&')
  url = url.replace(/=uid=/g, 'uid=')
  return url
}

exports.emailMeta = function(data) {
  // harvesting sender and receipient from email
  let meta = {}
  let stringFrom = 'From: '
  let stringTo = 'To: '
  let stringSubject = 'Subject: '
  meta.from = data.substring(
    data.indexOf(stringFrom), data.indexOf(stringTo)).replace(stringFrom, '').trim()
  meta.to = data.substring(
    data.indexOf(stringTo), data.indexOf(stringSubject)).replace(stringTo, '').trim()

  return meta
}