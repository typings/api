import express = require('express')

// Reference: https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters
export function track (title: string): express.RequestHandler {
  return function (req, res, next) {
    if (!req.visitor) {
      return next()
    }

    const data = {
      dp: req.originalUrl,
      dt: title,
      dh: req.hostname,
      uip: req.ip,
      dr: req.headers['referer'] || req.headers['referrer'],
      ua: req.headers['user-agent']
    }

    req.visitor.pageview(data).send()

    return next()
  }
}
