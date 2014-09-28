'use strict';

var app = angular.module('app', [
  'ngRoute',
  'ui.filters'
]);

app.config(['$routeProvider', '$locationProvider', '$httpProvider', function($routeProvider, $locationProvider, $httpProvider) {
	$routeProvider.when('/', {
			templateUrl: '/views/home.html',
			controller: 'HomeController',
			title: 'Dashboard',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/sync', {
			templateUrl: '/views/sync.html',
			controller: 'SyncController',
			title: 'Sync'
		})
		.when('/login', {
			templateUrl: '/views/login.html',
			controller: 'LoginController',
			title: 'Login',
		})
		.when('/gitlab', {
			templateUrl: '/views/login_gitlab.html',
			title: 'GitLab Login',
		})
		.when('/setup', {
			templateUrl: '/views/setup.html',
			controller: 'SetupController',
			title: 'Setup'
		})
		.when('/setup/:remote', {
			templateUrl: '/views/setup.html',
			controller: 'SetupController',
			title: 'Setup'
		})
		.when('/account/profile', {
			templateUrl: '/views/account.html',
			controller: 'UserController',
			title: 'Profile',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/account/repos', {
			templateUrl: '/views/repo_list.html',
			controller: 'AccountReposController',
			title: 'Repositories',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/admin/users/add', {
			templateUrl: '/views/users_add.html',
			controller: 'UserAddController',
			title: 'Add User',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/admin/users/:host/:login', {
			templateUrl: '/views/users_edit.html',
			controller: 'UserEditController',
			title: 'Edit User',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/admin/users', {
			templateUrl: '/views/users.html',
			controller: 'UsersController',
			title: 'System Users',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/admin/settings', {
			templateUrl: '/views/config.html',
			controller: 'ConfigController',
			title: 'System Settings',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/:remote/:owner/:name/settings', {
			templateUrl: '/views/repo_edit.html',
			controller: 'RepoConfigController',
			title: 'Repository Settings',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/:remote/:owner/:name/:branch/:commit', {
			templateUrl: '/views/commit.html',
			controller: 'CommitController',
			title: 'Recent Commits',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/:remote/:owner/:name/:branch/:commit/:build', {
			templateUrl: '/views/build.html',
			controller: 'BuildController',
			title: 'Build',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				}
			}
		})
		.when('/:remote/:owner/:name', {
			templateUrl: '/views/repo.html',
			controller: 'RepoController',
			title: 'Recent Commits',
			resolve: {
				user: function(authService) {
					return authService.getUser();
				},
				repo: function($route, repos) {
					var remote = $route.current.params.remote;
					var owner  = $route.current.params.owner;
					var name   = $route.current.params.name;
					return repos.getRepo(remote, owner, name);
				}
			}
		});

	// use the HTML5 History API
	$locationProvider.html5Mode(true);

	$httpProvider.interceptors.push(function($q, $location) {
		return {
			'responseError': function(rejection) {
				if (rejection.status == 401 && rejection.config.url != "/v1/user") {
					$location.path('/login');
				}
				return $q.reject(rejection);
			}
		};
	});
}]);

/* also see https://coderwall.com/p/vcfo4q */
app.run(['$location', '$rootScope', '$routeParams', 'feed', 'stdout', function($location, $rootScope, $routeParams, feed, stdout) {

	$rootScope.$on('$routeChangeStart', function (event, next) {
		feed.unsubscribe();
		stdout.unsubscribe();
	});

    $rootScope.$on('$routeChangeSuccess', function (event, current, previous) {
        document.title = current.$$route.title + ' · drone.io';
    });

}]);




/* Controllers */




app.controller("AccountReposController", function($scope, $http, user) {

	$scope.user = user;

	// get the user details
	$http({method: 'GET', url: '/v1/user/repos'}).
		success(function(data, status, headers, config) {
			$scope.repos = (typeof data==='string')?[]:data;
		}).
		error(function(data, status, headers, config) {
			console.log(data);
		});

	$scope.active="";
	$scope.remote="";
	$scope.byActive = function(entry){
			switch (true) {
			case $scope.active == "true"  && !entry.active: return false;
			case $scope.active == "false" &&  entry.active: return false;
			}
			return true;
		};
	$scope.byRemote = function(entry){
			return $scope.remote == "" || $scope.remote == entry.remote; 
		}; 
});