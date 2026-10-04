import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/mcp-oauth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL});
const {allowedOAuthRedirect,parseOAuthRequest,oauthMetadata,protectedResourceMetadata,MCP_RESOURCE,MCP_ORIGIN}=exports;
test('only exact ChatGPT OAuth callbacks are accepted',()=>{
 assert.equal(allowedOAuthRedirect('https://chatgpt.com/connector_platform_oauth_redirect'),true);
 assert.equal(allowedOAuthRedirect('https://chatgpt.com/connector/oauth/callback123'),true);
 for(const url of ['https://chatgpt.com.evil.example/connector_platform_oauth_redirect','http://chatgpt.com/connector_platform_oauth_redirect','https://chatgpt.com/connector_platform_oauth_redirect?next=evil','https://example.com/callback','https://chatgpt.com/other','invalid'])assert.equal(allowedOAuthRedirect(url),false);
});
const valid=()=>new URLSearchParams({client_id:'00000000-0000-0000-0000-000000000000',redirect_uri:'https://chatgpt.com/connector_platform_oauth_redirect',response_type:'code',code_challenge_method:'S256',code_challenge:'a'.repeat(43),resource:MCP_RESOURCE,scope:'alyquest',state:'opaque-state'});
test('authorization requires PKCE S256, intended resource and exact scope',()=>{
 assert.equal(parseOAuthRequest(valid()).state,'opaque-state');
 for(const [key,value] of [['resource','https://other.example'],['code_challenge_method','plain'],['code_challenge','short'],['scope','admin'],['response_type','token'],['client_id','invented']]){const params=valid();params.set(key,value);assert.equal(parseOAuthRequest(params),null);}
});
test('OAuth metadata binds the canonical resource, issuer and PKCE',()=>{
 assert.equal(protectedResourceMetadata().resource,MCP_RESOURCE);
 assert.equal(protectedResourceMetadata().authorization_servers[0],oauthMetadata().issuer);
 assert.equal(oauthMetadata().issuer,MCP_ORIGIN);
 assert.deepEqual(Array.from(oauthMetadata().code_challenge_methods_supported),['S256']);
 assert.equal(oauthMetadata().authorization_response_iss_parameter_supported,true);
});
