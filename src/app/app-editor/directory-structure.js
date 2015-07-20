function DirectoryStructureFactory ($process, $compile, EditorService, DirectoryStructure) {
	return {
		scope: {
			nodes: '=nodes'
		},
		controller: function ($scope, $element, $attrs) {
			var cwd = $process.cwd();

			var defaultEditor = EditorService.getEditor('default');

			this.readFile = function (file) {
				defaultEditor.readFile(file);
			};

			this.isActive = function (file) {
				var activeTab = defaultEditor.getActiveTab();
				return activeTab && activeTab.compareFile(file);
			};

			DirectoryStructure.getStructure().then(function (directoryStructure) {
				var nodes = directoryStructure.getElements();

				nodes.addClass('files-list');

				$compile(nodes)($scope);

				$element.append(nodes);
			});
		},
		controllerAs: 'structureCtrl'
	};
}

angular.module('textEditor')
.directive('nodeHasChildren', function ($animate, $helpers) {
	function postLink (scope, element, attrs) {
		var apply = $helpers.digest(scope);

		function addClass(addClass) {
			removeClass(false);
		}

		function removeClass(rly) {
			apply(function () {
				$animate[rly === false && 'addClass' ||
				_.isUndefined(rly) && 'removeClass'](element, 'opened')
			});
		}

		element.on('click', function (event) {
			var targetEl 	= event.target;
			var tagName 	= targetEl.tagName;

			if(!(targetEl.tagName === 'A' && targetEl.parentNode === element[0])) {
				return;
			}

			var hasClass = element.hasClass('opened');

			if(hasClass) {
				removeClass();
			} else {
				addClass();
			}
		});
	}

	return {
		compile: function (element, attrs) {
			element
			.children('a')
			.append('<i class="chevron">');

			return postLink;
		}
	};
})
.directive('directoryStructure', DirectoryStructureFactory);