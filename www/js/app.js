function AppController ($scope) {
}
AppController.$inject = ["$scope"];

angular.module('textEditor', [
	'ui.router'
])
.config(["$stateProvider", "$urlRouterProvider", function ($stateProvider, $urlRouterProvider) {
	$stateProvider
	.state('app', {
		url: '/app',
		templateUrl: 'app.html',
		controller: AppController
	});
	$urlRouterProvider.otherwise('/app/editor');
}]);
var _ 						= require('lodash');
var fs 						= require('fs');
var util						= require('util');
var some					= _.some;
var first					= _.first;
var filter					= _.filter;
var extend				= _.extend;
var isEmpty				= _.isEmpty;
var isEqual				= _.isEqual;
var isArray				= _.isArray;
var forEach				= _.forEach;
var defaults				= _.defaults;
var EditSession 		= ace.require('ace/edit_session').EditSession;
var UndoManager 	= ace.require('ace/undomanager').UndoManager;
var isUndefined		= _.isUndefined;
var EventEmitter		= require('events');
var id = 0;
function getId() {
	id++;
	return id;
}

function Tab (file, editorSession) {
	EventEmitter.call(this);

	this.id = getId();
	this.file = file;
	this.editorSession = editorSession;

	/**
	 * Update the session value
	 * everytime you change your
	 * file content
	 */
	this.on('fileContentUpdated', function () {
		this.editorSession.setValue(this.getFileContent());
	});

	this.updateFileContent();

	this.editorSession.setOption('mode', 'ace/mode/javascript');
}
Tab.prototype = {
	close: function () {
		this.emit('destroy');
		this.file = undefined;
	},

	getId: function () {
		return this.id;
	},

	hasModifiedContent: function () {
		return !isEqual(this.getFileContent(), this.editorSession.getValue());
	},

	updateContent: function (fileContent) {
		this.file.content = fileContent;

		this.emit('fileContentUpdated');
	},

	updateFileContent: function () {
		if(!this.file.content) {
			this.updateContent(fs.readFileSync(this.file.path).toString());
		}
	},

	getFileContent: function () {
		return this.file.content;
	},

	compareFile: function (file) {
		return file.path === this.file.path;
	},

	getFile: function() {
		return this.file;
	},

	getEditorSession: function () {
		return this.editorSession;
	}
};
extend(Tab.prototype, EventEmitter.prototype);

function TextEditor(element, options) {
	EventEmitter.call(this);

	this.element = element;
	this.node = this.element[0];

	this.initAce();

	this.on('tabChanged', function (tab) {
		this.editor.setSession(tab.getEditorSession());
	});

	this.on('optionChanged', function (key, value) {
		this.editor.setOption(key, value);
	});

	this.on('errorUndefinedOption', function (key, value) {
		console.info(`[ERROR] undefined option value (${key}: ${value})`);
	});

	this.setOptions(options);

	forEach(TextEditor.defaults, function (defaultValue, key) {
		if(isUndefined(this.options[key])) {
			this.setOption(key, defaultValue);
		}
	}, this);
	this.createTemporaryTab();
}

TextEditor.prototype = {
	options: {},

	initAce: function () {
		var self = this;

		this.editor = ace.edit(this.node);
		this.editor.on('change', function (e) {
			self.emit('change', e);
		});
	},

	getValue: function () {
		return this.editor.getValue();
	},

	setOptions: function (options) {
		forEach(options, function (value, key) {
			this.setOption(key, value);
		}, this);
	},

	setOption: function (key, value) {
		if(isUndefined(value)) {
			this.emit('errorUndefinedOption', key, value);
			return;
		}

		this.options[key] = value;

		this.emit('optionChanged', key, value);
		this.emit(`${key}:optionChanged`, value);
	},

	// Tabs

	tabs: [],

	activeTab: 0,

	addTab: function (tab) {
		this.tabs.push(tab);

		return tab;
	},

	getTabIndex: function (tab) {
		var tabId = tab.getId();
		var tabIndex = 0;

		forEach(this.tabs, function (tab, index) {
			if(tab.id === tabId) {
				tabIndex = index;
			}
		});

		return tabIndex;
	},

	createTemporaryTab: function () {
		var file = {
			content: getId(),
			name: 'untitled',
			path: getId()
		};
		var session = new EditSession('type me out');
		session.setUndoManager(new UndoManager());
		var tab = new Tab(file, session);
		this.addTab(tab);
		this.setTabActive(tab);
	},

	removeTab: function (tab) {
		if(!confirm('Are you sure you want to close this tab?')) {
			return;
		}

		var oldTabIndex = this.getTabIndex(tab);
		this.tabs.splice(oldTabIndex, 1);
		tab = undefined;

		if(isEmpty(this.tabs)) {
			this.createTemporaryTab();
			return;
		}

		if((oldTabIndex - 1) < 0) {
			this.setTabActive(first(this.tabs));
		} else if (oldTabIndex - 1 > this.tabs.length - 1) {
			this.setTabActive(this.tabs[this.tabs.length - 1]);
		} else {
			this.setTabActive(first(this.tabs));
		}
	},

	getTabById: function (tabId) {
		return first(filter(this.tabs, function (tab) {
			return tab.getId() === tabId;
		}));
	},

	setTabActive: function (tabId) {
		var tab;

		if(tabId instanceof Tab) {
			tab = tabId;
			tabId = tab.getId();
		} else {
			tab = this.getTabById(tabId);
		}

		if(this.activeTab === tabId) {
			this.emit('errorAlreadyActiveTabReactivation');
			return;
		}

		var tab = this.getTabById(tabId);
		
		if(!tab) {
			throw new Error(`there is not tab with id ${tabId}`);
		}

		this.activeTab = tab.id;
		this.emit('tabChanged', tab);
	},

	getActiveTab: function () {
		return this.getTabById(this.activeTab);
	},

	getTabByFile: function (file) {
		return first(filter(this.tabs, function (tab) {
			return tab && tab.compareFile(file);
		}));
	},

	tabExists: function (file) {
		return some(this.tabs, function (tab) {
			return tab && tab.compareFile(file);
		});
	},

	readFile: function (file) {
		var self = this;

		if(this.tabExists(file)) {
			this.setTabActive(this.getTabByFile(file).id);
			return;
		}

		var session = new EditSession('');
		session.setUndoManager(new UndoManager());

		var tab = this.addTab(new Tab(file, session));
		this.setTabActive(tab);

		tab.once('destroy', function () {
			self.removeTab(tab);
		});
	},

	getTabs: function () {
		return this.tabs;
	}
};

extend(TextEditor.prototype, EventEmitter.prototype);

TextEditor.defaults = {
	theme: 'ace/styles/github',
	mode: 'ace/mode/javascript'
};

function TextEditorFactory () {
	return TextEditor;
}

angular.module('textEditor')
.factory('EditorService', ["$q", function ($q) {
	function EditorService () {
		EventEmitter.call(this);
	}
	EditorService.prototype = {
		setEditor: function (key, value) {
			this.registry[key] = value;

			this.emit('editorRegistered', key);

			return this;
		},

		getEditor: function (key) {
			var self = this;

			return this.registry[key]
		},

		registry: {}
	};
	extend(EditorService.prototype, EventEmitter.prototype);

	return new EditorService();
}])
.factory('TextEditor', TextEditorFactory)
.directive('textEditor', ["TextEditor", "EditorService", function (TextEditor, EditorService) {
	return {
		scope: {
			theme: '=theme'
		},
		link: function (scope, element, attrs) {
			var textEditor = new TextEditor(element);

			EditorService.setEditor('default', textEditor);

			scope.$watch('theme', function (themeName) {
				textEditor.setOption('theme', themeName);
			});

			textEditor.on('change', function () {
				if(!(scope.$$phase || scope.$root.$$phase)) {
					scope.$apply();
				}
			});
		}
	};
}]);
angular.module('textEditor')
.directive('tabsList', ["EditorService", function (EditorService) {
	return {
		restrict: 'E',
		controller: ["$scope", "$element", "$attrs", function ($scope, $element, $attrs) {
			var defaultEditor = EditorService.getEditor('default');

			$scope.tabs = defaultEditor.tabs;
			$scope.setTabActive = function (tab) {
				defaultEditor.setTabActive(tab);
			};

			$scope.isActive = function (tab) {
				var activeTab = defaultEditor.getActiveTab();

				return activeTab && activeTab.id === tab.id;
			};
		}],
		templateUrl: 'components/tabs-list.html'
	};
}])
angular.module('textEditor')
.factory('$process', ["$window", function ($window) {
	return $window.process;
}]);
var _				= require('lodash');
var fs 			= require('fs');
var glob 		= require('glob');
var path 		= require('path');
var first		= _.first;

angular.module('textEditor')
.directive('directoryStructure', ["$process", "EditorService", function ($process, EditorService) {
	return {
		templateUrl: 'components/directory-structure.html',
		scope: {},
		controller: ["$scope", "$element", "$attrs", function ($scope, $element, $attrs) {
			var cwd = $process.cwd();

			function getFileName(path) {
				return first(/([A-z]+(\s)?\.[A-z]+)$/.exec(path));
			}

			var files = glob.sync(path.resolve(cwd, '*.*')).map(function (path) {
				return { path: path, name: getFileName(path) };
			});

			$scope.files = files;

			var defaultEditor = EditorService.getEditor('default');

			this.readFile = function (file) {
				defaultEditor.readFile(file);
			};

			this.isActive = function (file) {
				var activeTab = defaultEditor.getActiveTab();
				return activeTab && activeTab.compareFile(file);
			};
		}],
		controllerAs: 'structureCtrl'
	};
}])
function EditorController($scope) {
}
EditorController.$inject = ["$scope"];

angular.module('textEditor')
.config(["$stateProvider", function ($stateProvider) {
	$stateProvider
	.state('app.editor', {
		url: '/editor',
		templateUrl: 'app-editor.html',
		controller: EditorController,
		controllerAs: 'editorCtrl'
	});
}]);