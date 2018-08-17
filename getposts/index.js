const fetch = require('node-fetch');
const AWS = require('aws-sdk');
AWS.config.update({
    region: "ap-southeast-1"
});
const db = new AWS.DynamoDB.DocumentClient();

console.log('Loading function');

exports.handler = async (event, context) => {
    try {
        await fetchPosts();

        const response = {
            'message': 'new posts fetched'
        };

        return response;
    } catch (err) {
        console.error(err);
    }
};

async function fetchPosts() {
    try {
        let data = await fetch(process.env.SITE_SCRAPPING_URL);
        // get posts
        let response = await data.json();
        // filter what we need
        const result = await parseData(response);
        // save in db
        await saveData(result);
    } catch (err) {
        console.error(err);
    }
};

async function parseData(res) {
    return res &&
    res.blocks &&
    res.blocks
        .filter(d => (d.type === 'article-cluster' || d.type === 'teaser-block'))
        .reduce((a, b) => {
            return a.concat(b.teasers)
        }, [])
        // todo get unique id
        .slice(0, 20)
        .map(d => {
            return {
                'id': d.id,
                'link': d.link,
                'content': `${d.kicker}. ${d.headline}. ${d.lead}`,
                'updatedDate': d.updatedDate
            }
        });
};

async function saveData(data) {
    data.forEach((post, index) => {
        let params = {
            TableName: 'alexa-latest-posts',
            Item: {
                'ArticleID': post.id,
                'index': ''+index,
                'link': post.link,
                'content': post.content,
                'dateAdded': post.updatedDate,
                'sortArticleID': post.id
            }
        };

        db.put(params, (err, data) => {
            if (err) {
                console.error(`Failed to upload post ${index}, ${JSON.stringify(err, null, 2)}`);
            } else {
                console.log(`Post Uploaded: ${post.id}`);
            }
        })
    });
}
