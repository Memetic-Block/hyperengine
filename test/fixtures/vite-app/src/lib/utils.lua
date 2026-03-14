local M = {}

function M.get_name(address)
  return string.sub(address, 1, 8) .. "..."
end

return M
