'use strict';

const Alexa = require('alexa-sdk');
const AWS = require('aws-sdk');
const TableName = 'alexa-latest-posts';

const db = new AWS.DynamoDB.DocumentClient({
    region: "ap-southeast-1",
    TableName: TableName
});
const APP_ID = process.env.ALEXA_APP_ID;

function parsePosts(posts) {
    let p = posts.slice(0, 15).map(p => p.content);
    let str = '';

    p.forEach((po, index) => {
        po = po.replace('&', 'and');
        if (index != 0) {
            str += '<break time="1s"/> ';
        }
        str += `Article ${index + 1}: `;
        str += po + ' ';
    });

    return str;
}

function getPosts() {
    const currentTime = new Date();
    const startTime = new Date((currentTime).getTime() - 3600000).toISOString();

    const params = {
        region: 'ap-southeast-1',
        TableName: 'alexa-latest-posts',
        ProjectionExpression: 'content',
        FilterExpression: '#dateAdded between :date1 and :date2',
        ExpressionAttributeNames: {
            '#dateAdded': 'dateAdded'
        },
        ExpressionAttributeValues: {
            ':date1': startTime,
            ':date2': currentTime.toISOString()
        }
    };

    return db.scan(params).promise();
}


module.exports.handler = (event, context, callback) => {
  console.log(`handler: ${JSON.stringify(event.request)}`);

  // prepare alexa-sdk
  const alexa = Alexa.handler(event, context);
  alexa.appId = APP_ID;
  alexa.registerHandlers(handlers);
  alexa.execute();
};

const handlers = {
    'LaunchRequest': function() {
        console.log('LaunchRequest');
        console.log(JSON.stringify(this.event));
        this.emit('ReadNews');
    },
    'ReadNews': function() {
        console.log('ReadNews Intent' + JSON.stringify(this.event));
        const that = this;
        return getPosts()
            .then(posts => {
                let results = parsePosts(posts.Items);
                let reprompt = 'Say, read news or read latest posts';
                const firstspeak = 'Good Evening, here are your news. <break time="0.5s"/> ';
                that.response.speak(firstspeak + results + ' ' + reprompt)
                    .listen(reprompt);
                that.emit(':responseReady');
            });
    },
    'AMAZON.RepeatIntent': function() {
        console.log('RepeatIntent');
        this.emit('ReadNews');
    },
    'AMAZON.StopIntent': function() {
        console.log(`StopIntent: ${JSON.stringify(this.event)}`);
        this.emit('CompleteExit');
    },
    'AMAZON.CancelIntent': function() {
        this.emit('CompleteExit');
    },
    'CompleteExit': function() {
        console.log('StopIntent');
        let arr = ['goodbye','thank you see you later','pleasure serving you','<emphasis level="strong">I\'ll be back</emphasis>','have a nice day'];
        let speechOutput =  arr[Math.floor(Math.random()*arr.length)];
        let cardTitle = 'Exit.';
        let cardContent = speechOutput;
        let imageObj = undefined;
        this.response.speak(speechOutput)
            .cardRenderer(cardTitle, cardContent, imageObj);
        this.emit(':responseReady');
    },
    'RestartNews': function() {
        console.log('RestartNews');
        this.emit('ReadNews');
    },
    'Unhandled': function() {
        console.log('Unhandled');
        let reprompt = 'Say, read news or read latest posts';
        let cardTitle = 'Unhandled';
        let cardContent = reprompt;
        let speechOutput = reprompt;
        let imageObj = undefined;
        this.response.speak(speechOutput)
            .listen(reprompt)
            .cardRenderer(cardTitle, cardContent, imageObj);
        this.emit(':responseReady');
    },
    'SessionEndedRequest': function() {
        console.log('SessionEnd');
        console.log(`Session ended: ${this.event.request.reason}`);
    }
};
