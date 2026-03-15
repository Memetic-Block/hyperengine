local utils = require('lib.utils')

local M = {}

function M.read(address)
  return utils.get_name(address)
end

return M
