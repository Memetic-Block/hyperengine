local hyperstache = require('hyperstache')
local json = require('json')

local admin = {}

local _path = 'admin'
local template_name = 'admin/index.html'

function admin.publish()
  hyperstache.publishTemplate(template_name, _path, function()
    local hyperstache_state = hyperstache.get_state()
    local hyperstache_acl = {}
    for address, roles in pairs(hyperstache_state.acl or {}) do
      local role_list = ''
      for role, _ in pairs(roles) do
        if role_list ~= '' then role_list = role_list .. ',' end
        role_list = role_list .. role
      end
      table.insert(hyperstache_acl, { address = address, roles = role_list })
    end
    return {
      ao_env_json = json.encode(ao.env),
      hyperstache_state_json = json.encode(hyperstache_state),
      hyperstache_state = hyperstache_state,
      hyperstache_acl = hyperstache_acl,
      hyperstache_acl_json = json.encode(hyperstache_acl),
    }
  end)
end

admin.publish()

return admin
