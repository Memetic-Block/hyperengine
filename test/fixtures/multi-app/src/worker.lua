local utils = require('lib.utils')

local function handle(msg)
  local name = utils.get_name(msg.From)
  Send({ device = 'patch@1.0', result = 'processed by ' .. name })
end

Handlers.add('process', Handlers.utils.hasMatchingTag('Action', 'Process'), handle)
