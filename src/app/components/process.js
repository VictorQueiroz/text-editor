angular.module('textEditor')
.factory('$process', function ($window) {
	return $window.process;
});