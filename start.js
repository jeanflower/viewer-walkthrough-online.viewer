/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

//-------------------------------------------------------------------
// These packages are included in package.json.
// Run `npm install` to install them.
// 'path' is part of Node.js and thus not inside package.json.
//-------------------------------------------------------------------
const express = require('express');           // For web server
const Axios = require('axios');               // A Promised base http client
const body_parser = require('body-parser');    // Receive JSON format

// Set up Express web server
const app = express();
app.use(body_parser.json());
app.use(express.static(__dirname + '/www'));

// This is for web server to start listening to port 3000
const PORT = process.env.PORT || 3000;
// console.log(`PORT = ${PORT}`);
app.set('port', PORT);
const server = app.listen(
  app.get('port'),
  () => {
    console.log('Server listening on port ' + server.address().port);
  }
);

//-------------------------------------------------------------------
// Configuration for your Forge account
// Initialize the 2-legged OAuth2 client, and
// set specific scopes
//-------------------------------------------------------------------
const FORGE_CLIENT_ID = process.env.FORGE_CLIENT_ID;
const FORGE_CLIENT_SECRET = process.env.FORGE_CLIENT_SECRET;

if (FORGE_CLIENT_ID === undefined) {
  console.log(`You need to set an environment variable for FORGE_CLIENT_ID`);
}
if (FORGE_CLIENT_SECRET === undefined) {
  console.log(`You need to set an environment variable for FORGE_CLIENT_SECRET`);
}

let access_token = '';
const scopes = 'data:read data:write data:create bucket:create bucket:read';
const querystring = require('querystring');

// Route /api/forge/oauth
// uses oath
// pass in 
// data : client_id, client_secret, grant_type, scopes
// get back an access_token
// and redirect to /api/forge/datamanagement/bucket/create
app.get('/api/forge/oauth', (req, res) => {
  Axios({
    method: 'POST',
    url: 'https://developer.api.autodesk.com/authentication/v1/authenticate',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    data: querystring.stringify({
      client_id: FORGE_CLIENT_ID,
      client_secret: FORGE_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: scopes, //read-, write-, create- data and create- read- bucket
    })
  })
    .then((response) => {
      // Success
      console.log('/api/forge/oauth success');
      access_token = response.data.access_token;
      // console.log(response);
      res.redirect('/api/forge/datamanagement/bucket/create');
    })
    .catch((error) => {
      // Failed
      console.log('/api/forge/oauth fail');
      console.log(error);
      res.send('Failed to authenticate, check client id and client secret');
    });
});

// Route /api/forge/oauth/public
// uses oath
// pass in 
// data: clientId, clientSecret, grantType, scopes
// get back an access_token
app.get('/api/forge/oauth/public', (req, res) => {
  // Limit public token to Viewer read only
  Axios({
    method: 'POST',
    url: 'https://developer.api.autodesk.com/authentication/v1/authenticate',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    data: querystring.stringify({
      client_id: FORGE_CLIENT_ID,
      client_secret: FORGE_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'viewables:read'
    })
  })
    .then((response) => {
      // Success
      console.log('/api/forge/oauth/public success getting public access token');
      // console.log(response);
      res.json({
        access_token: response.data.access_token,
        expires_in: response.data.expires_in,
      });
    })
    .catch((error) => {
      // Failed
      console.log('/api/forge/oauth/public fail getting public access token');
      console.log(error);
      res.status(500).json(error);
    });
});

// Bucket key and Policy Key for OSS
// Prefix with your ID so the bucket key is 
// unique across all buckets on all other accounts
const bucket_key =
  FORGE_CLIENT_ID.toLowerCase()
  + '_tutorial_bucket';
const policy_key = 'transient'; // Expires in 24hr

// Route /api/forge/datamanagement/bucket/create
// uses datamanagement
// pass in 
// headers: access_token, 
// data: bucketKey and policyKey
// redirect to /api/forge/datamanagement/bucket/detail
app.get('/api/forge/datamanagement/bucket/create', (req, res) => {
  // Create an application shared bucket using access token from previous route
  if (access_token === '') {
    console.log('Missing access token');
    res.send('Missing access token');
  }
  // We will use this bucket for storing all files in this tutorial
  Axios({
    method: 'POST',
    url: 'https://developer.api.autodesk.com/oss/v2/buckets',
    headers: {
      'content-type': 'application/json',
      Authorization: 'Bearer ' + access_token
    },
    data: JSON.stringify({
      'bucketKey': bucket_key,
      'policyKey': policy_key
    })
  })
    .then((response) => {
      // Success
      console.log('/api/forge/datamanagement/bucket/create success, validate by seeking details');
      // console.log(response);
      res.redirect('/api/forge/datamanagement/bucket/detail');
    })
    .catch((error) => {
      console.log('/api/forge/datamanagement/bucket/create fail to create a new bucket');
      if (error.response && error.response.status == 409) {
        console.log('Bucket already exists, validate by seeking details');
        res.redirect('/api/forge/datamanagement/bucket/detail');
      } else {
        // Failed
        console.log(error);
        res.send('Failed to create a new bucket');
      }
    });
});

// Route /api/forge/datamanagement/bucket/detail
// uses datamanagement
// pass in 
// url: bucketKey, 
// headers: access_token
// redirect to /upload.html
app.get('/api/forge/datamanagement/bucket/detail', (req, res) => {
  if (access_token === '') {
    console.log('Missing access token');
    res.send('Missing access token');
  }
  Axios({
    method: 'GET',
    url:
      'https://developer.api.autodesk.com/oss/v2/buckets/'
      + encodeURIComponent(bucket_key)
      + '/details',
    headers: {
      Authorization: 'Bearer ' + access_token
    }
  })
    .then((response) => {
      // Success
      console.log('/api/forge/datamanagement/bucket/detail success - bucket verified');
      console.log('present upload page and ready for further interaction\n');
      // console.log(response);
      res.redirect('/upload.html');
    })
    .catch((error) => {
      // Failed
      console.log('/api/forge/datamanagement/bucket/detail fail');
      console.log(error);
      res.send('Failed to verify the new bucket');
    });
});

// For converting the source into a Base64-Encoded string
Buffer = require('buffer').Buffer;
String.prototype.toBase64 = function () { // needs 'this'
  // Create buffer object, specifying utf8 as encoding
  let buffer_obj = Buffer.from(this, "utf8");
  // Encode the Buffer as a base64 string
  return buffer_obj.toString("base64");
};

const multer = require('multer');         // To handle file upload
const upload = multer({ dest: 'tmp/' }); // Save file into local /tmp folder

// Route /api/forge/datamanagement/bucket/upload
// uses datamanagement
// pass in 
// url: bucketKey, originalname
// headers: access_token, originalname
// data: filecontent
// redirect to /api/forge/modelderivative/ with urn
app.post('/api/forge/datamanagement/bucket/upload',
  upload.single('fileToUpload'),
  (req, res) => {
    if (access_token === '') {
      console.log('Missing access token');
      res.send('Missing access token');
    }
    const fs = require('fs'); // Node.js File system for reading files
    fs.readFile(
      req.file.path,
      (err, file_content) => {
        Axios({
          method: 'PUT',
          url:
            'https://developer.api.autodesk.com/oss/v2/buckets/'
            + encodeURIComponent(bucket_key)
            + '/objects/'
            + encodeURIComponent(req.file.originalname),
          headers: {
            Authorization: 'Bearer ' + access_token,
            'Content-Disposition': req.file.originalname,
            'Content-Length': file_content.length
          },
          data: file_content
        })
        .then((response) => {
          // Success
          console.log('/api/forge/datamanagement/bucket/upload success');
          // console.log(response);
          const urn = response.data.objectId.toBase64();
          res.redirect('/api/forge/modelderivative/' + urn);
        })
        .catch((error) => {
          // Failed
          console.log('/api/forge/datamanagement/bucket/upload fail');
          console.log(error);
          res.send('Failed to create a new object in the bucket');
        });
    });
  }
);

// Route /api/forge/modelderivative
// uses modelderivative
// pass in
// params: urn
// headers: access_token
// data: urn
// redirect to /viewer.html?urn=' + urn
app.get(
  '/api/forge/modelderivative/:urn',
  (req, res) => {
    if (access_token === '') {
      console.log('Missing access token');
      res.send('Missing access token');
    }
    const urn = req.params.urn;
    const format_type = 'svf';
    const format_views = ['2d', '3d'];
    Axios({
      method: 'POST',
      url: 'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + access_token
      },
      data: JSON.stringify({
        'input': {
          'urn': urn
        },
        'output': {
          'formats': [
            {
              'type': format_type,
              'views': format_views
            }
          ]
        }
      })
    })
    .then((response) => {
      // Success
      console.log('/api/forge/modelderivative/:urn success');
      // console.log(response);
      res.redirect('/viewer.html?urn=' + urn);
    })
    .catch((error) => {
      // Failed
      console.log('/api/forge/modelderivative/:urn fail');
      // console.log(error);
      res.send('Error at Model Derivative job.');
    });
  });
