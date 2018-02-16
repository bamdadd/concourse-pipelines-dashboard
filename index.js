var express = require('express');
var bodyParser = require('body-parser');
var config = require('./config')
var request = require('request')
var _ = require('lodash');

var app = express();

app.set('port', (process.env.PORT || 8099));
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.use(express.static(__dirname + '/resources'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


var pipelines = [];
var environments = [];

const doRequest = (options) => new Promise((resolve, reject) => {
	request(options, (error, response, body) => {
		if (!error && response.statusCode === 200) {
			resolve(body)
		} else {
			console.log(error, "somethig happened")
			reject(error)
		}
	})
})

const get_health_for_environments =  () => {
	environments = []
  var environment_urls = config.healthcheck_environment_urls;
	return Promise.all(environment_urls.map(env => {
		const options = { url: env.url, json: true, strictSSL: false }
		return doRequest(options)
	})).then((environments) => {
		return environments.map((environment, index) => ({
			healthchecks: (environment.healthchecks || []).map( service => (
				{ status: service.isHealthy ? "healthy" : "unhealthy", name: `${environment_urls[index].name} ${service.service}`}
			)),
			status: environment.isHealthy ? "healthy" : "unhealthy"
		}))
	})
}

get_pipelines = function (callback) {
	request({
		url: config.concourse_url + config.api_subdirectory + "/pipelines",
		auth: {
			username: config.concourse_username,
			password: config.concourse_password
		},
		json: true,
		strictSSL: false
	}, function (error, response, body) {
		if (!error && response.statusCode === 200) {
			pipelines = body;
			callback();
		} else {
			console.log(error);
		}
	});
}

get_pipeline_statuses = function () {
	_.forEach(pipelines, function (pipeline) {
		request({
			url: config.concourse_url + config.api_subdirectory + pipeline.url + "/jobs",
			json: true,
			strictSSL: false
		}, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				_.forEach(body, function(task) {
					if(task.finished_build !== undefined && task.finished_build !== null) {
						var index = _.findIndex(pipelines, { 'name': task.finished_build.pipeline_name });
						if(pipelines[index]["status"] === undefined || pipelines[index]["status"] === "succeeded")
							pipelines[index]["status"] = task.finished_build.status;
					}
				})
			}
		});
	})
}

setInterval(function() {
	get_pipelines(get_pipeline_statuses);
	get_health_for_environments()
		.then(results => {
			environments.splice(0)
			results.forEach(item => environments.push(item))
		})
}, 5000);

app.get('/', function (req, res) {
	res.render('overview', { config: config, pipelines: pipelines || [], environments: environments || [] });
});

app.listen(app.get('port'), function () {
	console.log('running on port', app.get('port'));
});
