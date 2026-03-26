local hyperstache = require('hyperstache')
local json = require('json')

local admin = {}

local _path = 'admin'

function admin.publish()
  local routes = {
    { path = 'index', title = 'Home' },
    { path = 'templates', title = 'Templates' },
    { path = 'publish', title = 'Publish' },
    { path = 'acl', title = 'Access Control' }
  }

  local dataFn = function(current_page) return function()
    local hyperstache_state = hyperstache.get_state()

    local hyperstache_acl = {}
    for address, roles in pairs(hyperstache_state.acl or {}) do
      local role_list = {}
      for role, _ in pairs(roles) do
        table.insert(role_list, role)
      end
      table.insert(hyperstache_acl, { address = address, roles = role_list })
    end

    return {
      ao_env = ao.env,
      hyperstache_state = hyperstache_state,
      hyperstache_acl = hyperstache_acl,
      current_page = current_page,
      navigation_links = routes,
      nav_css = function(self)
        return self.path == current_page and 'current-page' or ''
      end,
      ui_root = hyperstache_state.ui_root,

      -- JSON injection for lazy debugging
      ao_env_json = json.encode(ao.env),
      hyperstache_state_json = json.encode(hyperstache_state),
      hyperstache_acl_json = json.encode(hyperstache_acl),
    }
  end end

  for _, route in pairs(routes) do
    local ok, err = pcall(hyperstache.publishTemplate,
      'admin/template.html',
      _path .. '/' .. route.path,
      dataFn(route.path),
      {
        header = hyperstache.get('admin/partials/header.mu'),
        nav = hyperstache.get('admin/partials/nav.mu'),
        body = hyperstache.get('admin/pages/' .. route.path .. '.mu'),
        footer = hyperstache.get('admin/partials/footer.mu')
      }
    )
    assert(ok, 'Error publishing admin template: ' .. err)
  end
end

admin.publish()

return admin
