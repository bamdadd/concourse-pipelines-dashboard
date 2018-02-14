var config = {}
config.concourse_url  = "http://product-concourse.prod.transit.ri-tech.io"; //Replace with your concourse url
config.api_subdirectory = "/api/v1";
config.concourse_username = "";
config.concourse_password = "";
config.healthcheck_environment_urls = [{
  name: "dev",
  url: "http://product-dev-alb.dev.transit.ri-tech.io/injector-api/healthcheck"
},
  {
    name: "prod",
    url: "http://product-prod-alb.prod.transit.ri-tech.io/injector-api/healthcheck"
  }
]

module.exports = config;
