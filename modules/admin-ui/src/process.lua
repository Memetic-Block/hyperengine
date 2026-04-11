local hyperengine = require('hyperengine')
require('admin')

hyperengine.publishTemplate('index.html', 'home', function() return { title = 'Hello', name = Owner } end)

hyperengine.sync()
