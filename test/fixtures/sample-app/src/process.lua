local utils = require("lib.utils")
local templates = require("templates")
local lustache = require("lustache")

Handlers.add("home", { Action = "Home" }, function(msg)
  local data = { title = "Welcome", name = msg.From }
  local html = lustache:render(templates["index.html"], data)
  msg.reply({ Data = html })
end)

Handlers.add("profile", { Action = "Profile" }, function(msg)
  local data = { username = utils.get_name(msg.From) }
  local html = lustache:render(templates["profile.htm"], data)
  msg.reply({ Data = html })
end)
