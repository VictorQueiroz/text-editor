function $HelpersFactory($timeout) {
	return {
		digest: curry(function (scope, fn) {
			if(scope.$$phase || scope.$root.$$phase) {
				fn(scope);
			} else {
				scope.$apply(fn);
			}
		})
	};
}

angular.module('textEditor')
.factory('$helpers', $HelpersFactory);