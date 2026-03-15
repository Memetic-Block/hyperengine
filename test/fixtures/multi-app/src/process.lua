local utils = require('lib.utils')
local templates = require('templates')
local lustache = require('lustache')

Send({
  device = 'patch@1.0',
  index = lustache:render(templates['index.html'], { title = 'Welcome', name = Owner })
})
