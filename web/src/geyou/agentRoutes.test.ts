import {test} from 'node:test';
import assert from 'node:assert/strict';
import {agentRoute} from './agentRoutes';
test('standalone routes preserve agent deep links and public notices',()=>{
 for(const route of ['/agent','/agent/chat?session=s1&action=package','/agent/portraits?portrait=p1','/agent/notice-preview/p1','/notice/n1','/notice-preview/n1'])assert.equal(agentRoute(route),route);
});
test('full-workspace and unknown routes resolve to the standalone agent home',()=>{
 for(const route of ['','/home','/platform','/settings','/shared/agent','/dashboard','/shop','/agent-other'])assert.equal(agentRoute(route),'/agent');
});
