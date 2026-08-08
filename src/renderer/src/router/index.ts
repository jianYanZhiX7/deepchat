import { createRouter, createWebHashHistory } from 'vue-router'
import { createOAuthClient, type OAuthClient } from '@api/OAuthClient'
import type { AigotokenAuthStatus } from '@shared/contracts/routes'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/chat'
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('@/apps/chat-main/ChatTabView.vue'),
      meta: {
        titleKey: 'routes.chat',
        icon: 'lucide:message-square'
      }
    },
    {
      path: '/plugins',
      component: () => import('@/pages/plugins/PluginsHubPage.vue'),
      meta: {
        titleKey: 'routes.plugins',
        icon: 'lucide:puzzle'
      },
      children: [
        {
          path: '',
          name: 'plugins',
          component: () => import('@/pages/plugins/PluginsCatalogPage.vue'),
          meta: {
            titleKey: 'routes.plugins',
            icon: 'lucide:puzzle'
          }
        },
        {
          path: 'skills',
          name: 'plugins-skills',
          component: () => import('@/pages/plugins/SkillsPluginsPage.vue'),
          meta: {
            titleKey: 'routes.settings-skills',
            icon: 'lucide:wand-sparkles'
          }
        },
        {
          path: 'mcp',
          name: 'plugins-mcp',
          component: () => import('@/pages/plugins/McpPluginsPage.vue'),
          meta: {
            titleKey: 'routes.settings-mcp',
            icon: 'lucide:server'
          }
        },
        {
          path: 'builtin/ocr',
          name: 'plugins-builtin-ocr',
          component: () => import('@/pages/plugins/OcrPluginsPage.vue'),
          meta: {
            titleKey: 'routes.settings-ocr',
            icon: 'lucide:scan-text'
          }
        },
        {
          path: 'remote',
          redirect: { name: 'plugins' }
        },
        {
          path: 'remote/:channel',
          redirect: (to) => ({
            name: 'plugins-detail',
            params: { pluginId: `remote:${String(to.params.channel)}` }
          })
        },
        {
          path: 'official/:pluginId',
          redirect: (to) => ({
            name: 'plugins-detail',
            params: { pluginId: String(to.params.pluginId) }
          })
        },
        {
          path: ':pluginId',
          name: 'plugins-detail',
          component: () => import('@/pages/plugins/OfficialPluginDetailPage.vue'),
          meta: {
            titleKey: 'routes.plugins',
            icon: 'lucide:puzzle'
          }
        }
      ]
    },
    {
      path: '/welcome',
      name: 'welcome',
      component: () => import('@/pages/WelcomePage.vue'),
      meta: {
        titleKey: 'routes.welcome',
        icon: 'lucide:message-square'
      }
    },
    {
      path: '/aigotoken-login',
      name: 'aigotoken-login',
      component: () => import('@/pages/AigotokenLoginPage.vue'),
      meta: {
        titleKey: 'routes.welcome',
        icon: 'lucide:message-square'
      }
    }
  ]
})

export function createAigotokenAuthGuard(getStatus: () => Promise<AigotokenAuthStatus>) {
  return async (to: { name: unknown }) => {
    if (to.name === 'aigotoken-login') return true
    const { authenticated } = await getStatus()
    return authenticated ? true : { name: 'aigotoken-login' }
  }
}

let oauthClient: OAuthClient | null = null
const getAigotokenStatus = () => (oauthClient ??= createOAuthClient()).getAigotokenStatus()

router.beforeEach(createAigotokenAuthGuard(getAigotokenStatus))

export default router
