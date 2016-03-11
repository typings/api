import uuid = require('node-uuid')
import express = require('express')
import ua = require('universal-analytics')

const analyticsId = process.env.UA_ID

// Reference: https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters
export function track (title: string): express.RequestHandler {
  if (!analyticsId) {
    return function (req, res, next) {
      next()
    }
  }

  return function (req, res, next) {
    const data = {
      dp: req.originalUrl,
      dt: title,
      dh: req.hostname,
      uip: req.ip,
      dr: req.headers['referer'] || req.headers['referrer'],
      ua: req.headers['user-agent']
    }

    const id = req.headers['typings-client-id'] || uuid.v1()
    const visitor = ua(analyticsId, id)

    res.setHeader('Typings-Client-Id', id)

    visitor.pageview(data).send()

    return next()
  }
}
