angular.module('textEditor')
.directive('tabsList', function (EditorService) {
	return {
		restrict: 'E',
		controller: function ($scope, $element, $attrs) {
			var defaultEditor = EditorService.getEditor('default');

			$scope.tabs = defaultEditor.tabs;
			$scope.setTabActive = function (tab) {
				defaultEditor.setTabActive(tab);
			};

			$scope.isActive = function (tab) {
				var activeTab = defaultEditor.getActiveTab();

				return activeTab && activeTab.id === tab.id;
			};
		},
		templateUrl: 'app-editor/tabs-list.html'
	};
})