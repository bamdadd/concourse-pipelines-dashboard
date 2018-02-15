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

get_health_for_environments = function (callback) {
	environments = []
  var environment_urls = config.healthcheck_environment_urls;
	_.forEach(environment_urls, function (env, index) {
			request({ url: env.url, json: true, strictSSL: false }, function (error, response, body) {
				if( !error && response.statusCode === 200 && body.healthchecks) {
					body.healthchecks.forEach(function (service) {
						service.status = service.isHealthy ? "healthy" : "unhealthy";
						service.name = env.name + " " + service.service;
					});
					body.status = body.isHealthy ? "healthy" : "unhealthy";
					environments[index] = body;
				}
			})
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
}, 5000);

app.get('/', function (req, res) {
	res.render('overview', { config: config, pipelines: pipelines || [], environments: environments || [] });
});

app.listen(app.get('port'), function () {
	console.log('running on port', app.get('port'));
});
