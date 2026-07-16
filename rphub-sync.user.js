// ==UserScript==
// @name         RP-Hub Sync & Plaza LAN Hijack
// @namespace    rphub
// @version      2.0.0
// @description  RP-Hub 跨设备 GitHub 同步（增量/分片/角色卡剥离）+ 广场 LAN 优先/源站兜底资源挟持 + 下载次数绕过（支持 Tampermonkey/Violentmonkey/Firefox Mobile）
// @author       You
// @match        https://*.github.io/RP-Hub/*
// @match        https://rphforum.zeabur.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        unsafeWindow
// @connect      api.github.com
// @connect      192.168.31.40
// @connect      *
// @run-at       document-start
// ==/UserScript==

    // ===== 第三方库：qrcode-generator v1.4.4 =====
    // Copyright (c) 2009 Kazuhiko Arase - MIT License
    // http://www.opensource.org/licenses/mit-license.php
    // QR Code is a registered trademark of DENSO WAVE INCORPORATED
var qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=M(t);break;case"Alphanumeric":e=x(t);break;case"Byte":e=m(t);break;case"Kanji":e=L(t);break;default:throw"mode:"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+","+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<f.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=f.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},f.createSvgTag=function(t,r,e,n){var o={};"object"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l="";for(c="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",l+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',l+=o.scalable?"":' width="'+g+'px" height="'+g+'px"',l+=' viewBox="0 0 '+g+" "+g+'" ',l+=' preserveAspectRatio="xMinYMin meet"',l+=n.text||e.text?' role="img" aria-labelledby="'+y([n.id,e.id].join(" ").trim())+'"':"",l+=">",l+=n.text?'<title id="'+y(n.id)+'">'+y(n.text)+"</title>":"",l+=e.text?'<description id="'+y(e.id)+'">'+y(e.text)+"</description>":"",l+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',l+='<path d="',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+="M"+(i*t+r)+","+u+c);return l+='" stroke="transparent" fill="black"/>',l+="</svg>"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1})},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=f.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=y(e),o+='"'),o+="/>"};var y=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={"██":"█","█ ":"▀"," █":"▄","  ":" "},l={"██":"▀","█ ":"▀"," █":" ","  ":" "},h="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",h+=t<1&&r+1>=c?l[i]:g[i];h+="\n"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join("▀"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join("██"),l=Array(t+1).join("  "),h="",s="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s="",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+"\n"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?"black":"white",t.fillRect(n*r,o*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw"eof";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+" != "+r;return i}(),n="?".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];"number"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw"mode:"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw"glog("+t+")";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+"/"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw"bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(){var t=n("友");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw"sjis not supported."}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r="";r+="[";for(var e=0;e<t.length;e+=1)e>0&&(r+=","),r+=t[e];return r+="]"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw"unexpected end of file./"+o}var t=r.charAt(e);if(e+=1,"="==t)return o=0,-1;t.match(/^\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString("GIF87a"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(";")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw"length over";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw"dup key:"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n="",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+="="},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return t}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){"function"==typeof define&&define.amd?define([],t):"object"==typeof exports&&(module.exports=t())}(function(){return qrcode});

(function () {
    'use strict';

    // ============================================================
    // 配置常量
    // ============================================================
    const DB_NAME = 'RPHubDB';
    const DB_STORE = 'store';
    const SYNC_DIR = 'rp-hub-sync';
    const SYNC_STATE_PATH = `${SYNC_DIR}/state.enc.json`;
    const SYNC_CARD_MAP_PATH = `${SYNC_DIR}/card-id-map.enc.json`;
    const SYNC_CHATS_INDEX_PATH = `${SYNC_DIR}/chats-index.enc.json`;
    const SYNC_CHATS_DIR = `${SYNC_DIR}/chats`;
    // 旧版兼容：v1.x 使用单个 snapshot.enc.json
    const LEGACY_SYNC_FILE_PATH = `${SYNC_DIR}/snapshot.enc.json`;
    const SYNC_BRANCH = 'main';

    // 角色卡相关 key 前缀
    const KEY_CHARACTERS = 'rp_hub_characters';
    const KEY_CHAT_PREFIX = 'rp_hub_chat_';
    const KEY_MEMORIES_PREFIX = 'rp_hub_memories_';
    const KEY_CLASSIC_MEMORIES_PREFIX = 'rp_hub_classic_memories_';
    const KEY_SETTINGS = 'rp_hub_settings';

    // 大小阈值（bytes）
    const SIZE_WARN_BYTES = 25 * 1024 * 1024; // 25 MB 预警
    const SIZE_MAX_BYTES = 90 * 1024 * 1024;  // 90 MB 接近 GitHub content limit

    // ============================================================
    // 环境判断
    // ============================================================
    const isRpHub = /github\.io\/RP-Hub/.test(location.href);
    const isPlaza = location.hostname.includes('rphforum.zeabur.app');

    function onDomReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
        } else {
            fn();
        }
    }

    // 广场被 RP-Hub 以跨域 iframe 嵌入时，浏览器会拦截 autofocus 并刷控制台警告：
    // "Blocked autofocusing on a <input> element in a cross-origin subframe"。
    // 已确认无法根治：警告来自源站 HTML 第 908 行模板里的 <input autofocus>，
    // Chrome 在解析期同步记录，页面侧脚本（含 document-start）无法抢在其前面。
    // 这里只抑制加载完成后、用户首次交互前的"动态"程序化 focus()（如评论框），
    // 不再剥离 autofocus 属性（剥了也挡不住解析期警告，反而让搜索弹窗失去自动聚焦）。
    const inCrossOriginSubframe = (() => {
        try {
            if (window.self === window.top) return false;
            void window.top.location.href; // 跨域访问会抛异常
            return false;
        } catch (e) {
            return true;
        }
    })();

    function suppressIframeAutofocus() {
        let activated = false;
        const mark = () => { activated = true; };
        document.addEventListener('pointerdown', mark, { capture: true, once: true });
        document.addEventListener('keydown', mark, { capture: true, once: true });

        const proto = unsafeWindow.HTMLElement && unsafeWindow.HTMLElement.prototype;
        if (proto && typeof proto.focus === 'function') {
            const origFocus = proto.focus;
            Object.defineProperty(proto, 'focus', {
                configurable: true,
                writable: true,
                value: function (...args) {
                    if (!activated) return;
                    return origFocus.apply(this, args);
                },
            });
        }
    }

    // favicon：站点根 favicon.ico 不存在会 404；以 data URI 注入 link，零网络请求。
    // 仓库根目录另有 favicon.svg 实体文件（新文件，上游合并不会冲突丢失）。
    const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="14" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/><text x="32" y="41" font-family="'Segoe UI',system-ui,-apple-system,Arial,sans-serif" font-size="26" font-weight="700" fill="#111827" text-anchor="middle" letter-spacing="1">RP</text></svg>`;

    function injectFavicon() {
        if (document.querySelector('link[rel~="icon"]')) return;
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = 'data:image/svg+xml,' + encodeURIComponent(FAVICON_SVG);
        (document.head || document.documentElement).appendChild(link);
    }

    if (isRpHub) {
        injectFavicon();
        onDomReady(initRpHubSync);
    } else if (isPlaza) {
        if (inCrossOriginSubframe) suppressIframeAutofocus();
        initPlazaHijack();
    }

    // ============================================================
    // 统一配置管理
    // ============================================================
    function getConfig() {
        return {
            // GitHub 同步配置
            githubToken: GM_getValue('github_token', ''),
            githubOwner: GM_getValue('github_owner', ''),
            githubRepo: GM_getValue('github_repo', 'RP-Hub-Sync'),
            githubBranch: GM_getValue('github_branch', SYNC_BRANCH),
            syncPassphrase: GM_getValue('sync_passphrase', ''),

            // 广场资源配置
            lanBaseUrl: GM_getValue('plaza_lan_url', 'http://192.168.31.40:8765'),
            sourceBaseUrl: GM_getValue('plaza_source_url', 'https://rphforum.zeabur.app'),
            sourceDownloadTemplate: (() => {
                const v = GM_getValue('plaza_source_download_template', '');
                // 旧默认值（错误的 404 端点）自动迁移到已验证的直链模板
                if (!v || v === 'https://rphforum.zeabur.app/api/cards/{id}/download') {
                    return 'https://rphforum.zeabur.app/api/cards/{id}/download/file';
                }
                return v;
            })(),
            enableLan: GM_getValue('plaza_enable_lan', true),

            // 调试
            debug: GM_getValue('rphub_debug', true),
        };
    }

    function setConfig(key, value) {
        GM_setValue(key, value);
    }

    function log(...args) {
        const cfg = getConfig();
        if (cfg.debug) {
            console.log('[RP-Hub Sync]', ...args);
        }
    }

    // ============================================================
    // 可视化配置面板
    // ============================================================
    function createConfigPanel() {
        if (document.getElementById('rphub-config-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'rphub-config-panel';
        panel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 320px;
            max-height: 90vh;
            overflow-y: auto;
            background: rgba(255,255,255,0.98);
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            padding: 16px;
            z-index: 999999;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            color: #1f2937;
        `;

        const cfg = getConfig();
        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <strong style="font-size:14px;">RP-Hub 同步配置</strong>
                <button id="rphub-config-close" style="background:none;border:none;cursor:pointer;font-size:18px;color:#6b7280;">×</button>
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">GitHub Token</label>
                <input type="password" id="rphub-cfg-token" value="${escapeHtml(cfg.githubToken)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">GitHub Owner</label>
                <input type="text" id="rphub-cfg-owner" value="${escapeHtml(cfg.githubOwner)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">Sync Repo</label>
                <input type="text" id="rphub-cfg-repo" value="${escapeHtml(cfg.githubRepo)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">同步口令</label>
                <input type="password" id="rphub-cfg-passphrase" value="${escapeHtml(cfg.syncPassphrase)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">局域网 RP-Hub-Card 地址</label>
                <input type="text" id="rphub-cfg-lan" value="${escapeHtml(cfg.lanBaseUrl)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
                <div style="font-size:11px;color:#6b7280;margin-top:4px;">例如：http://192.168.31.40:8765</div>
            </div>
            <div style="margin-bottom:10px;">
                <label style="display:block;margin-bottom:4px;color:#374151;">源站下载 URL 模板</label>
                <input type="text" id="rphub-cfg-download-template" value="${escapeHtml(cfg.sourceDownloadTemplate)}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
                <div style="font-size:11px;color:#6b7280;margin-top:4px;">用 {id} 占位，例如：https://rphforum.zeabur.app/api/cards/{id}/download/file</div>
            </div>
            <div style="margin-bottom:12px;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" id="rphub-cfg-enablelan" ${cfg.enableLan ? 'checked' : ''}>
                    <span>启用局域网优先</span>
                </label>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
                <button id="rphub-btn-save" style="flex:1;padding:8px;border:none;border-radius:6px;background:#4f46e5;color:#fff;cursor:pointer;">保存配置</button>
                <button id="rphub-btn-test-lan" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">测试 LAN</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="rphub-btn-push" style="flex:1;padding:8px;border:none;border-radius:6px;background:#059669;color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><polyline points="5 12 12 5 19 12"/></svg>推送</button>
                <button id="rphub-btn-pull" style="flex:1;padding:8px;border:none;border-radius:6px;background:#d97706;color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><polyline points="19 12 12 19 5 12"/></svg>拉取</button>
            </div>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button id="rphub-btn-export" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">导出配置</button>
                <button id="rphub-btn-import" style="flex:1;padding:8px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">导入配置</button>
            </div>
            <div id="rphub-export-area" style="display:none;margin-top:10px;">
                <div id="rphub-qr-box" style="display:flex;justify-content:center;margin-bottom:8px;"></div>
                <textarea id="rphub-export-text" readonly rows="3" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;font-size:11px;resize:vertical;"></textarea>
                <button id="rphub-btn-copy-export" style="width:100%;margin-top:6px;padding:6px;border:1px solid #d1d5db;border-radius:6px;background:#fff;cursor:pointer;">复制配置串</button>
                <div style="font-size:11px;color:#dc2626;margin-top:6px;">含明文 Token 与口令，勿示他人。另一设备：相机扫码复制文本，或转发此串，在面板上「导入配置」。</div>
            </div>
            <div id="rphub-import-area" style="display:none;margin-top:10px;">
                <textarea id="rphub-import-text" rows="3" placeholder="粘贴配置串（RPHUB1. 开头）" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;font-size:11px;resize:vertical;"></textarea>
                <button id="rphub-btn-do-import" style="width:100%;margin-top:6px;padding:6px;border:none;border-radius:6px;background:#4f46e5;color:#fff;cursor:pointer;">确认导入</button>
                <div style="font-size:11px;color:#6b7280;margin-top:6px;">导入会覆盖本机现有配置；局域网地址请按本机网络环境核对。</div>
            </div>
            <div id="rphub-config-status" style="margin-top:10px;font-size:12px;color:#6b7280;min-height:18px;"></div>
        `;

        document.body.appendChild(panel);

        document.getElementById('rphub-config-close').addEventListener('click', () => panel.remove());
        document.getElementById('rphub-btn-save').addEventListener('click', saveConfigFromPanel);
        document.getElementById('rphub-btn-test-lan').addEventListener('click', testLanConnection);
        document.getElementById('rphub-btn-push').addEventListener('click', pushStateToGitHub);
        document.getElementById('rphub-btn-pull').addEventListener('click', pullStateFromGitHub);
        document.getElementById('rphub-btn-export').addEventListener('click', toggleExportArea);
        document.getElementById('rphub-btn-import').addEventListener('click', toggleImportArea);
        document.getElementById('rphub-btn-copy-export').addEventListener('click', copyExportText);
        document.getElementById('rphub-btn-do-import').addEventListener('click', doImportConfig);
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function saveConfigFromPanel() {
        setConfig('github_token', document.getElementById('rphub-cfg-token').value.trim());
        setConfig('github_owner', document.getElementById('rphub-cfg-owner').value.trim());
        setConfig('github_repo', document.getElementById('rphub-cfg-repo').value.trim() || 'RP-Hub-Sync');
        setConfig('sync_passphrase', document.getElementById('rphub-cfg-passphrase').value);
        setConfig('plaza_lan_url', document.getElementById('rphub-cfg-lan').value.trim());
        setConfig('plaza_source_download_template', document.getElementById('rphub-cfg-download-template').value.trim() || 'https://rphforum.zeabur.app/api/cards/{id}/download/file');
        setConfig('plaza_enable_lan', document.getElementById('rphub-cfg-enablelan').checked);
        showConfigStatus('✅ 配置已保存');
    }

    async function testLanConnection() {
        const cfg = getConfig();
        showConfigStatus('正在测试 LAN...');
        try {
            const res = await lanRequest(`${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/status`, { timeout: 5000 });
            if (res && res.status === 200) {
                const data = JSON.parse(res.responseText);
                showConfigStatus(`✅ LAN 可达，文件数：${data.pic ? data.pic.length : 'unknown'}`);
            } else {
                showConfigStatus(`❌ LAN 返回 ${res && res.status}`);
            }
        } catch (e) {
            showConfigStatus(`❌ LAN 不可达：${e.message}`);
        }
    }

    function showConfigStatus(msg) {
        const el = document.getElementById('rphub-config-status');
        if (el) el.textContent = msg;
    }

    // ============================================================
    // 配置导入/导出（跨设备迁移：配置串 + 面板内二维码）
    // ============================================================
    const CFG_EXPORT_PREFIX = 'RPHUB1.';

    function exportConfigString() {
        const cfg = getConfig();
        const payload = {
            v: 1,
            t: cfg.githubToken || '',
            o: cfg.githubOwner || '',
            r: cfg.githubRepo || '',
            p: cfg.syncPassphrase || '',
            l: cfg.lanBaseUrl || '',
            d: cfg.sourceDownloadTemplate || '',
            e: !!cfg.enableLan,
        };
        const bytes = new TextEncoder().encode(JSON.stringify(payload));
        let bin = '';
        bytes.forEach((b) => { bin += String.fromCharCode(b); });
        return CFG_EXPORT_PREFIX + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function importConfigString(input) {
        let s = String(input || '').trim();
        if (s.startsWith(CFG_EXPORT_PREFIX)) s = s.slice(CFG_EXPORT_PREFIX.length);
        s = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
        while (s.length % 4) s += '=';
        let payload;
        try {
            const bin = atob(s);
            const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
            payload = JSON.parse(new TextDecoder().decode(bytes));
        } catch (e) {
            throw new Error('配置串无法解析');
        }
        if (!payload || typeof payload !== 'object' || payload.v !== 1) {
            throw new Error('配置串版本不符');
        }
        if (payload.t !== undefined) setConfig('github_token', String(payload.t || ''));
        if (payload.o !== undefined) setConfig('github_owner', String(payload.o || ''));
        if (payload.r !== undefined) setConfig('github_repo', String(payload.r || '') || 'RP-Hub-Sync');
        if (payload.p !== undefined) setConfig('sync_passphrase', String(payload.p || ''));
        if (payload.l !== undefined) setConfig('plaza_lan_url', String(payload.l || ''));
        if (payload.d !== undefined) setConfig('plaza_source_download_template', String(payload.d || ''));
        if (payload.e !== undefined) setConfig('plaza_enable_lan', !!payload.e);
    }

    function toggleExportArea() {
        const area = document.getElementById('rphub-export-area');
        const importArea = document.getElementById('rphub-import-area');
        if (!area) return;
        const show = area.style.display === 'none';
        area.style.display = show ? 'block' : 'none';
        if (importArea) importArea.style.display = 'none';
        if (show) {
            const text = exportConfigString();
            const ta = document.getElementById('rphub-export-text');
            if (ta) ta.value = text;
            renderQrInto(document.getElementById('rphub-qr-box'), text);
        }
    }

    function toggleImportArea() {
        const area = document.getElementById('rphub-import-area');
        const exportArea = document.getElementById('rphub-export-area');
        if (!area) return;
        area.style.display = area.style.display === 'none' ? 'block' : 'none';
        if (exportArea) exportArea.style.display = 'none';
    }

    function renderQrInto(container, text) {
        if (!container) return;
        container.innerHTML = '';
        if (typeof qrcode !== 'function') {
            container.textContent = '(QR 生成库不可用，请直接复制配置串)';
            return;
        }
        try {
            const qr = qrcode(0, 'M'); // 0 = 自动选择版本，M 纠错
            qr.addData(text);
            qr.make();
            const modules = qr.getModuleCount();
            const cellSize = Math.max(1, Math.floor(240 / modules));
            container.innerHTML = qr.createSvgTag({ cellSize, margin: cellSize * 2 });
            const svg = container.querySelector('svg');
            if (svg) {
                svg.style.width = '100%';
                svg.style.maxWidth = '240px';
                svg.style.height = 'auto';
            }
        } catch (e) {
            container.textContent = '二维码生成失败：' + e.message;
        }
    }

    async function copyExportText() {
        const ta = document.getElementById('rphub-export-text');
        if (!ta || !ta.value) return;
        try {
            await navigator.clipboard.writeText(ta.value);
        } catch (e) {
            ta.select();
            document.execCommand('copy');
        }
        showConfigStatus('✅ 已复制配置串');
    }

    function doImportConfig() {
        const ta = document.getElementById('rphub-import-text');
        if (!ta || !ta.value.trim()) {
            showConfigStatus('❌ 请先粘贴配置串');
            return;
        }
        try {
            importConfigString(ta.value);
            showConfigStatus('✅ 配置已导入');
            // 重新打开面板刷新各字段显示
            const panel = document.getElementById('rphub-config-panel');
            if (panel) panel.remove();
            setTimeout(createConfigPanel, 50);
        } catch (e) {
            showConfigStatus('❌ 导入失败：' + e.message);
        }
    }

    // ============================================================
    // 第 1 部分：RP-Hub 状态同步
    // ============================================================
    // 广场页面可能被 RP-Hub 以 iframe 嵌入；iframe 内不注入悬浮按钮，避免双层
    function isTopFrame() {
        try {
            return window.self === window.top;
        } catch (e) {
            return true;
        }
    }

    function initRpHubSync() {
        registerSyncMenu();
        if (isTopFrame()) {
            injectSyncButton();
            // 页面加载后异步检查一次角色卡生命周期（更新/删除）
            setTimeout(() => {
                checkPlazaCardLifecycle().catch(e => log('Lifecycle check error:', e));
            }, 5000);
        }
    }

    function registerSyncMenu() {
        try {
            GM_registerMenuCommand('⚙️ RP-Hub 同步配置', createConfigPanel);
            GM_registerMenuCommand('📤 推送状态到 GitHub', pushStateToGitHub);
            GM_registerMenuCommand('📥 从 GitHub 拉取并覆盖', pullStateFromGitHub);
        } catch (e) {
            log('GM_registerMenuCommand failed:', e);
        }
    }

    // 白底小圆钮：可自由拖动、松手吸附最近侧边、无操作自动淡化，尽量不打断沉浸感
    const FLOAT_BTN_STYLE = `
        position: fixed;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid rgba(0,0,0,0.08);
        background: rgba(255,255,255,0.92);
        color: #6b7280;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.12);
        cursor: grab;
        z-index: 99999;
        opacity: 1;
        transition: opacity .3s;
        backdrop-filter: blur(4px);
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    `;

    const SYNC_SVG = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;pointer-events:none;"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>`;

    function makeFloatButton(id, title) {
        if (document.getElementById(id)) return null;
        const btn = document.createElement('button');
        btn.id = id;
        btn.innerHTML = SYNC_SVG;
        btn.title = title;
        btn.setAttribute('aria-label', title);
        btn.style.cssText = FLOAT_BTN_STYLE;
        document.body.appendChild(btn);

        // ---------- 位置：记忆 + 恢复（GM 存储跨域共享，两个站点通用） ----------
        const POS_KEY = 'float_btn_pos_v1';
        const saved = GM_getValue(POS_KEY, null);
        const pos = saved && typeof saved === 'object' && saved.side
            ? saved
            : { side: 'right', topRatio: 0.62 };

        const applyPos = (animate) => {
            const w = window.innerWidth, h = window.innerHeight;
            const bw = btn.offsetWidth || 40, bh = btn.offsetHeight || 40;
            const top = Math.min(Math.max(pos.topRatio * h - bh / 2, 8), h - bh - 8);
            const left = pos.side === 'left' ? 8 : w - bw - 8;
            btn.style.transition = animate ? 'left .25s ease, top .25s ease, opacity .3s' : 'opacity .3s';
            btn.style.left = left + 'px';
            btn.style.top = top + 'px';
        };
        applyPos(false);
        window.addEventListener('resize', () => applyPos(false));

        // ---------- 无操作自动淡化 ----------
        let idleTimer = null;
        const wake = () => {
            btn.style.opacity = '1';
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => { btn.style.opacity = '0.3'; }, 3000);
        };
        wake();
        btn.addEventListener('mouseenter', wake);

        // ---------- 拖拽 + 贴边吸附 ----------
        let dragging = false, moved = false, suppressClick = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        btn.addEventListener('pointerdown', (e) => {
            dragging = true;
            moved = false;
            startX = e.clientX;
            startY = e.clientY;
            const r = btn.getBoundingClientRect();
            startLeft = r.left;
            startTop = r.top;
            btn.style.cursor = 'grabbing';
            try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            wake();
            e.preventDefault();
        });

        btn.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (!moved && Math.hypot(dx, dy) > 6) moved = true;
            if (!moved) return;
            btn.style.transition = 'opacity .3s';
            const w = window.innerWidth, h = window.innerHeight;
            const bw = btn.offsetWidth, bh = btn.offsetHeight;
            const nl = Math.min(Math.max(startLeft + dx, 0), w - bw);
            const nt = Math.min(Math.max(startTop + dy, 0), h - bh);
            btn.style.left = nl + 'px';
            btn.style.top = nt + 'px';
            pos.topRatio = (nt + bh / 2) / h;
        });

        const endDrag = () => {
            if (!dragging) return;
            dragging = false;
            btn.style.cursor = 'grab';
            if (moved) {
                const r = btn.getBoundingClientRect();
                pos.side = (r.left + r.width / 2) < window.innerWidth / 2 ? 'left' : 'right';
                GM_setValue(POS_KEY, pos);
                applyPos(true);
                suppressClick = true;
                setTimeout(() => { suppressClick = false; }, 80);
            }
            wake();
        };
        btn.addEventListener('pointerup', endDrag);
        btn.addEventListener('pointercancel', endDrag);

        btn.addEventListener('click', (e) => {
            if (suppressClick) {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }
            createConfigPanel();
        });
        return btn;
    }

    function injectSyncButton() {
        makeFloatButton('rphub-floating-btn', 'RP-Hub 同步配置');
    }

    async function pushStateToGitHub() {
        const cfg = getConfig();
        if (!validateSyncConfig(cfg)) return;

        try {
            showConfigStatus('正在读取本地状态...');
            const data = await dumpIndexedDB();
            const analysis = analyzeIndexedDB(data);

            const warn = checkSizeWarning(analysis.total);
            if (warn) {
                if (warn.level === 'error') {
                    notify('⚠️ ' + warn.message, true);
                    if (!confirm('IndexedDB 体积过大，继续推送可能导致失败或超出 GitHub 限制。仍要继续吗？')) {
                        showConfigStatus('已取消推送');
                        return;
                    }
                } else {
                    notify('⚠️ ' + warn.message, true);
                }
            }

            showConfigStatus('正在准备同步包...');
            const { files, meta } = await prepareSyncPayload(data);
            log('Sync v2 payload:', meta);

            showConfigStatus(`正在上传到 GitHub（${files.length} 个文件）...`);
            const deviceId = await getDeviceId();
            const message = `RP-Hub sync v2 from ${deviceId} @ ${new Date().toISOString()}`;

            for (const file of files) {
                const existing = await getGitHubFileByPath(cfg, file.path);
                await putGitHubFile(cfg, file.path, file.content, message, existing && existing.sha);
                log('Uploaded:', file.path);
            }

            notify(`✅ 已推送 ${files.length} 个文件到 GitHub（剥离角色卡图片）`);
            showConfigStatus('✅ 推送成功');
        } catch (e) {
            console.error('[RP-Hub Sync] Push failed:', e);
            notify('❌ 推送失败: ' + e.message, true);
            showConfigStatus('❌ 推送失败: ' + e.message);
        }
    }

    async function pullStateFromGitHub() {
        const cfg = getConfig();
        if (!validateSyncConfig(cfg)) return;

        if (!confirm('确定要从 GitHub 拉取并覆盖本地所有数据吗？\n当前本地的角色、聊天记录、设置等将被替换。')) {
            return;
        }

        try {
            showConfigStatus('正在从 GitHub 下载...');

            // 优先尝试新版 v2 多文件结构
            const stateFile = await getGitHubFileByPath(cfg, SYNC_STATE_PATH);
            let data;
            if (stateFile) {
                data = await pullSyncV2(cfg);
            } else {
                // 兼容旧版 v1 单文件结构
                data = await pullSyncV1(cfg);
            }

            showConfigStatus('正在覆盖本地 IndexedDB...');
            await restoreIndexedDB(data);

            showConfigStatus('正在检查缺失角色卡...');
            await autoFillMissingCards(data);

            notify('✅ 恢复完成，即将刷新页面');
            showConfigStatus('✅ 拉取成功，刷新中...');
            setTimeout(() => location.reload(), 1500);
        } catch (e) {
            console.error('[RP-Hub Sync] Pull failed:', e);
            notify('❌ 拉取失败: ' + e.message, true);
            showConfigStatus('❌ 拉取失败: ' + e.message);
        }
    }

    async function pullSyncV1(cfg) {
        const file = await getGitHubFile(cfg);
        if (!file) {
            throw new Error('GitHub 上未找到同步文件（旧版 snapshot.enc.json 也不存在）');
        }
        log('sync v1 file meta:', { size: file.size, sha: file.sha, hasContent: !!file.content });
        const content = await getGitHubFileContent(cfg, file);
        if (!content) throw new Error('同步文件内容为空或已损坏');
        const payload = JSON.parse(content);
        return decryptSyncPayload(payload, cfg.syncPassphrase);
    }

    async function pullSyncV2(cfg) {
        showConfigStatus('发现新版同步结构，正在下载...');
        const stateEncrypted = await downloadAndDecryptFile(cfg, SYNC_STATE_PATH);
        const stateObj = JSON.parse(await gunzipText(await decrypt(base64ToArrayBuffer(stateEncrypted.encryptedBlob || stateEncrypted.content), cfg.syncPassphrase)));

        const mapEncrypted = await downloadAndDecryptFile(cfg, SYNC_CARD_MAP_PATH);
        // card-id-map 也加密，需要解密
        const mapContent = await decryptGitHubEncrypted(mapEncrypted, cfg.syncPassphrase);
        // state 中已有剥离 avatar 的 characters，无需额外处理 map

        const indexEncrypted = await downloadAndDecryptFile(cfg, SYNC_CHATS_INDEX_PATH);
        const indexContent = await decryptGitHubEncrypted(indexEncrypted, cfg.syncPassphrase);
        const chatsIndex = JSON.parse(indexContent);

        const chats = {};
        const chatKeys = Object.keys(chatsIndex.chats || {});
        for (let i = 0; i < chatKeys.length; i++) {
            const key = chatKeys[i];
            const fileName = key.replace(/^rp_hub_/, '').replace(/_/g, '-') + '.enc.json';
            showConfigStatus(`正在下载聊天记录 (${i + 1}/${chatKeys.length})...`);
            const chatEncrypted = await downloadAndDecryptFile(cfg, `${SYNC_CHATS_DIR}/${fileName}`);
            const chatContent = await decryptGitHubEncrypted(chatEncrypted, cfg.syncPassphrase);
            const chatObj = JSON.parse(chatContent);
            chats[chatObj.key] = chatObj.value;
        }

        return { ...stateObj.state, ...chats };
    }

    async function downloadAndDecryptFile(cfg, path) {
        const file = await getGitHubFileByPath(cfg, path);
        if (!file) throw new Error(`同步文件缺失: ${path}`);
        const content = await getGitHubFileContent(cfg, file);
        return JSON.parse(content);
    }

    async function decryptGitHubEncrypted(payload, passphrase) {
        const encrypted = base64ToArrayBuffer(payload.encryptedBlob || payload.content);
        const compressed = await decrypt(encrypted, passphrase);
        return gunzipText(compressed);
    }

    async function decryptSyncPayload(payload, passphrase) {
        const encrypted = base64ToArrayBuffer(payload.encryptedBlob);
        const compressed = await decrypt(encrypted, passphrase);
        const json = await gunzipText(compressed);
        return JSON.parse(json);
    }

    // ============================================================
    // 恢复后自动补回缺失角色卡
    // ============================================================
    async function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    async function writeIndexedDBKey(key, value) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction(DB_STORE, 'readwrite');
                const store = tx.objectStore(DB_STORE);
                store.put(value, key);
                tx.oncomplete = () => { db.close(); resolve(); };
                tx.onerror = () => { db.close(); reject(tx.error); };
            };
        });
    }

    async function readIndexedDBKey(key) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction(DB_STORE, 'readonly');
                const store = tx.objectStore(DB_STORE);
                const req = store.get(key);
                req.onsuccess = () => { db.close(); resolve(req.result); };
                req.onerror = () => { db.close(); reject(req.error); };
            };
        });
    }

    function fetchCardAsBlob(url, timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    responseType: 'blob',
                    timeout,
                    onload: (res) => {
                        if (res.status === 404) return reject(new Error('404'));
                        if (res.status >= 200 && res.status < 300 && res.response) {
                            resolve(res.response);
                        } else {
                            reject(new Error('HTTP ' + res.status));
                        }
                    },
                    onerror: () => reject(new Error('network')),
                    ontimeout: () => reject(new Error('timeout')),
                });
            } else {
                fetch(url, { signal: AbortSignal.timeout(timeout) })
                    .then(async (res) => {
                        if (res.status === 404) throw new Error('404');
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        resolve(await res.blob());
                    })
                    .catch(reject);
            }
        });
    }

    async function autoFillMissingCards(data) {
        const cfg = getConfig();
        const characters = data[KEY_CHARACTERS] || [];
        if (!Array.isArray(characters) || characters.length === 0) {
            log('autoFill: no characters');
            return;
        }

        const needFill = characters.filter(char => {
            if (!char || !char.plazaId) return false;
            const avatarMissing = !char.avatar ||
                char.avatar === '__RPHUB_SYNC_AVATAR_PLACEHOLDER__' ||
                char.avatar.startsWith('data:image/svg+xml');
            return avatarMissing;
        });

        log('autoFill candidates:', needFill.length, 'plazaIds:', needFill.map(c => c.plazaId));

        if (needFill.length === 0) {
            log('No missing cards need auto-fill');
            return;
        }

        // 预取 LAN manifest（如果启用）
        let manifest = null;
        if (cfg.enableLan && cfg.lanBaseUrl) {
            try {
                manifest = await getLanManifest(cfg);
                log('autoFill LAN manifest entries:', manifest ? Object.keys(manifest).length : 0);
            } catch (e) {
                log('autoFill LAN manifest failed:', e.message || e);
            }
        }

        let filled = 0;
        const failed = [];
        const deleted = [];

        for (let i = 0; i < needFill.length; i++) {
            const char = needFill[i];
            showConfigStatus(`正在补全角色卡 (${i + 1}/${needFill.length}): ${char.name}`);
            log('autoFill trying', char.name, char.plazaId);
            try {
                let blob = null;
                let source = '';

                // 1. 优先局域网：直接用 plazaId 查 manifest 文件名，避免跨 iframe blob URL
                if (manifest && manifest[char.plazaId] && manifest[char.plazaId].filename) {
                    const filename = manifest[char.plazaId].filename;
                    const lanUrl = `${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/image/${encodeURIComponent(filename)}`;
                    try {
                        blob = await fetchCardAsBlob(lanUrl);
                        if (blob && blob.size > 0) {
                            source = 'lan';
                            log('autoFill LAN hit:', char.name, filename);
                        }
                    } catch (e) {
                        log('autoFill LAN failed for', char.name, e.message || e);
                    }
                }

                // 2. 回退源站直链
                if (!blob) {
                    const sourceUrl = cfg.sourceDownloadTemplate.replace('{id}', encodeURIComponent(char.plazaId));
                    try {
                        blob = await fetchCardAsBlob(sourceUrl);
                        if (blob && blob.size > 0) {
                            source = 'source';
                            log('autoFill source hit:', char.name);
                        }
                    } catch (e) {
                        if (e.message === '404') {
                            deleted.push(char);
                            char.__rphubSyncPlazaDeleted__ = true;
                            log('autoFill source 404 (deleted):', char.name);
                            continue;
                        }
                        throw e;
                    }
                }

                if (!blob || blob.size === 0) throw new Error('empty blob');

                const dataUrl = await blobToDataUrl(blob);
                const blobKey = `rp_hub_card_blob_${char.plazaId}`;
                await writeIndexedDBKey(blobKey, blob);

                // 更新内存中的角色对象
                char.avatar = dataUrl;
                char.__rphubSyncAvatarStripped__ = false;
                filled++;
            } catch (e) {
                failed.push(char);
                log('Auto-fill failed for', char.name, char.plazaId, e.message || e);
            }
        }

        // 把更新后的 characters 写回 IndexedDB
        if (filled > 0 || deleted.length > 0) {
            await writeIndexedDBKey(KEY_CHARACTERS, characters);
            log('autoFill wrote characters back, filled:', filled, 'deleted:', deleted.length);
        }

        if (filled > 0) {
            notify(`✅ 已自动补回 ${filled} 张角色卡`);
        }
        if (deleted.length > 0) {
            notify(`⚠️ 以下角色卡已从广场删除，聊天记录已保留：${deleted.map(c => c.name).join('、')}`, true);
        }
        if (failed.length > 0) {
            notify(`❌ 以下角色卡补回失败（可稍后重试）：${failed.map(c => c.name).join('、')}`, true);
        }
    }

    // ============================================================
    // 生命周期：检测广场角色卡更新与删除
    // ============================================================
    async function checkPlazaCardLifecycle() {
        const cfg = getConfig();
        const characters = await readIndexedDBKey(KEY_CHARACTERS);
        if (!Array.isArray(characters)) return;

        const plazaChars = characters.filter(c => c && c.plazaId);
        if (plazaChars.length === 0) return;

        const updated = [];
        const deleted = [];
        const checked = [];

        for (const char of plazaChars.slice(0, 20)) { // 每次最多检查 20 张，避免配额
            try {
                const detail = await fetchPlazaCardDetail(char.plazaId, cfg);
                checked.push(char);
                if (!detail) {
                    deleted.push(char);
                } else if (detail.updated_at && char.plazaLastKnownUpdatedAt && detail.updated_at !== char.plazaLastKnownUpdatedAt) {
                    updated.push({ char, detail });
                }
            } catch (e) {
                log('Lifecycle check failed for', char.plazaId, e.message || e);
            }
        }

        if (deleted.length > 0) {
            notify(`⚠️ 广场已下架 ${deleted.length} 张角色卡，聊天记录已保留。`, true);
        }
        if (updated.length > 0) {
            // 默认提示，不自动覆盖
            const names = updated.map(u => u.char.name).join('、');
            notify(`🔄 广场有以下角色卡更新：${names}，请在广场重新导入覆盖。`, true);
        }
    }

    function fetchPlazaCardDetail(cardId, cfg) {
        return new Promise((resolve, reject) => {
            const url = `${cfg.sourceBaseUrl.replace(/\/+$/, '')}/api/cards/${encodeURIComponent(cardId)}`;
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    timeout: 15000,
                    onload: (res) => {
                        if (res.status === 404) return resolve(null);
                        if (res.status >= 200 && res.status < 300) {
                            try {
                                resolve(JSON.parse(res.responseText));
                            } catch (e) {
                                reject(e);
                            }
                        } else {
                            reject(new Error('HTTP ' + res.status));
                        }
                    },
                    onerror: () => reject(new Error('network')),
                    ontimeout: () => reject(new Error('timeout')),
                });
            } else {
                fetch(url, { signal: AbortSignal.timeout(15000) })
                    .then(async (res) => {
                        if (res.status === 404) return resolve(null);
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        resolve(await res.json());
                    })
                    .catch(reject);
            }
        });
    }

    function validateSyncConfig(cfg) {
        if (!cfg.githubToken || !cfg.githubOwner || !cfg.githubRepo || !cfg.syncPassphrase) {
            notify('请先配置 GitHub 同步参数', true);
            createConfigPanel();
            return false;
        }
        return true;
    }

    async function getGitHubFile(cfg) {
        try {
            const res = await githubRequest({
                method: 'GET',
                url: `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${SYNC_FILE_PATH}?ref=${cfg.githubBranch}`,
                headers: {
                    Authorization: `token ${cfg.githubToken}`,
                    Accept: 'application/vnd.github+json',
                },
            });
            if (!res.responseText) {
                throw new Error('GitHub 响应为空（网络异常或被拦截），请重试');
            }
            return JSON.parse(res.responseText);
        } catch (e) {
            if (e.status === 404) return null;
            throw e;
        }
    }

    // GitHub Contents API 对超过 1MB 的文件不内联 content（返回空字符串），
    // 此时必须改用 Git Blob API 按 sha 取内容
    async function getGitHubFileContent(cfg, file) {
        if (file.content) {
            return base64ToString(file.content);
        }
        if (!file.sha) return '';
        showConfigStatus('快照较大，正在通过 Blob API 下载...');
        const res = await githubRequest({
            method: 'GET',
            url: `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/git/blobs/${file.sha}`,
            headers: {
                Authorization: `token ${cfg.githubToken}`,
                Accept: 'application/vnd.github+json',
            },
        });
        if (!res.responseText) {
            throw new Error('GitHub Blob 响应为空（网络异常或被拦截），请重试');
        }
        const blob = JSON.parse(res.responseText);
        return base64ToString(blob.content || '');
    }

    async function getGitHubFileByPath(cfg, path) {
        try {
            const res = await githubRequest({
                method: 'GET',
                url: `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${path}?ref=${cfg.githubBranch}`,
                headers: {
                    Authorization: `token ${cfg.githubToken}`,
                    Accept: 'application/vnd.github+json',
                },
            });
            if (!res.responseText) return null;
            return JSON.parse(res.responseText);
        } catch (e) {
            if (e.status === 404) return null;
            throw e;
        }
    }

    async function putGitHubFile(cfg, path, contentBase64, message, existingSha) {
        const body = {
            message,
            content: contentBase64,
        };
        if (existingSha) body.sha = existingSha;
        await githubRequest({
            method: 'PUT',
            url: `https://api.github.com/repos/${cfg.githubOwner}/${cfg.githubRepo}/contents/${path}`,
            headers: {
                Authorization: `token ${cfg.githubToken}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            data: JSON.stringify(body),
        });
    }

    // ============================================================
    // IndexedDB 读取与恢复
    // ============================================================
    async function dumpIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction(DB_STORE, 'readonly');
                const store = tx.objectStore(DB_STORE);
                const data = {};

                const cursorReq = store.openCursor();
                cursorReq.onerror = () => reject(cursorReq.error);
                cursorReq.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        data[cursor.key] = cursor.value;
                        cursor.continue();
                    } else {
                        db.close();
                        resolve(data);
                    }
                };
            };
        });
    }

    async function restoreIndexedDB(data) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                const tx = db.transaction(DB_STORE, 'readwrite');
                const store = tx.objectStore(DB_STORE);

                store.clear();
                for (const [key, value] of Object.entries(data)) {
                    store.put(value, key);
                }

                tx.oncomplete = () => {
                    db.close();
                    resolve();
                };
                tx.onerror = () => reject(tx.error);
            };
        });
    }

    // ============================================================
    // IndexedDB 诊断与大小预警
    // ============================================================
    function estimateJsonSize(value) {
        try {
            return JSON.stringify(value).length;
        } catch (e) {
            return 0;
        }
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

    function analyzeIndexedDB(data) {
        const entries = Object.entries(data).map(([key, value]) => {
            const size = estimateJsonSize(value);
            return { key, size, type: typeof value };
        });
        entries.sort((a, b) => b.size - a.size);

        const total = entries.reduce((sum, e) => sum + e.size, 0);
        log('IndexedDB 总大小:', formatBytes(total), '共', entries.length, '个 key');
        log('Top 10 最大 key:');
        entries.slice(0, 10).forEach((e, i) => {
            log(`  #${i + 1} ${e.key}: ${formatBytes(e.size)} (${e.type})`);
        });

        return { total, entries, top10: entries.slice(0, 10) };
    }

    function checkSizeWarning(totalBytes) {
        if (totalBytes > SIZE_MAX_BYTES) {
            return { level: 'error', message: `IndexedDB 已达 ${formatBytes(totalBytes)}，接近 GitHub 单文件限制，请尽快清理或拆分数据。` };
        }
        if (totalBytes > SIZE_WARN_BYTES) {
            return { level: 'warn', message: `IndexedDB 为 ${formatBytes(totalBytes)}，建议清理旧聊天记录或开启增量同步。` };
        }
        return null;
    }

    // ============================================================
    // 角色卡资产剥离：同步时不传 PNG 二进制
    // ============================================================
    function isAvatarDataUrl(value) {
        return typeof value === 'string' && (
            value.startsWith('data:image/png;base64,') ||
            value.startsWith('data:image/jpeg;base64,') ||
            value.startsWith('data:image/webp;base64,') ||
            value.startsWith('blob:')
        );
    }

    function stripAvatar(value) {
        if (isAvatarDataUrl(value)) {
            return '__RPHUB_SYNC_AVATAR_PLACEHOLDER__';
        }
        return value;
    }

    function stripCharacterAvatars(characters) {
        if (!Array.isArray(characters)) return characters;
        return characters.map(char => {
            if (!char || typeof char !== 'object') return char;
            const clone = { ...char };
            if (isAvatarDataUrl(clone.avatar)) {
                clone.avatar = '__RPHUB_SYNC_AVATAR_PLACEHOLDER__';
                clone.__rphubSyncAvatarStripped__ = true;
            }
            // 历史兼容：有些版本可能把头像存在其他字段
            ['avatarUrl', 'profileImage', 'image'].forEach(field => {
                if (isAvatarDataUrl(clone[field])) {
                    clone[field] = '__RPHUB_SYNC_AVATAR_PLACEHOLDER__';
                    clone.__rphubSyncAvatarStripped__ = true;
                }
            });
            return clone;
        });
    }

    function buildCardIdMap(characters) {
        const map = {};
        if (!Array.isArray(characters)) return map;
        characters.forEach(char => {
            if (char && char.uuid && char.plazaId) {
                map[char.uuid] = char.plazaId;
            }
        });
        return map;
    }

    function classifyIndexedDBKeys(data) {
        const state = {};
        const chats = {};
        const chatUuids = new Set();

        for (const [key, value] of Object.entries(data)) {
            if (key === KEY_CHARACTERS) {
                state[key] = stripCharacterAvatars(value);
            } else if (key.startsWith(KEY_CHAT_PREFIX)) {
                chats[key] = value;
                const uuid = key.slice(KEY_CHAT_PREFIX.length);
                chatUuids.add(uuid);
            } else if (key.startsWith(KEY_MEMORIES_PREFIX) || key.startsWith(KEY_CLASSIC_MEMORIES_PREFIX)) {
                // memories 通常不大，但按角色拆分便于增量
                chats[key] = value;
            } else {
                state[key] = value;
            }
        }
        return { state, chats, chatUuids: Array.from(chatUuids) };
    }

    // ============================================================
    // 同步 payload 准备（v2 多文件结构）
    // ============================================================
    async function prepareSyncPayload(data) {
        const { state, chats } = classifyIndexedDBKeys(data);
        const characters = state[KEY_CHARACTERS] || [];
        const cardIdMap = buildCardIdMap(characters);

        // 聊天索引：记录每个聊天文件的大小，便于恢复时判断
        const chatsIndex = {};
        const chatEntries = Object.entries(chats);

        const files = [];
        const passphrase = getConfig().syncPassphrase;

        // 辅助：把加密后的 ArrayBuffer 包装成与 v1 兼容的 JSON payload
        async function makeEncryptedPayload(plaintextJson) {
            const encrypted = await encrypt(await gzipText(plaintextJson), passphrase);
            return stringToBase64(JSON.stringify({
                version: 2,
                encryptedBlob: arrayBufferToBase64(encrypted),
                encoding: 'base64+aes-gcm+gzip',
            }));
        }

        // state.enc.json
        const stateJson = JSON.stringify({
            version: 2,
            exportedAt: Date.now(),
            deviceId: await getDeviceId(),
            state,
        });
        files.push({ path: SYNC_STATE_PATH, content: await makeEncryptedPayload(stateJson) });

        // card-id-map.enc.json
        const mapJson = JSON.stringify(cardIdMap);
        files.push({ path: SYNC_CARD_MAP_PATH, content: await makeEncryptedPayload(mapJson) });

        // chats/<key>.enc.json
        for (const [key, value] of chatEntries) {
            const fileName = key.replace(/^rp_hub_/, '').replace(/_/g, '-') + '.enc.json';
            const chatJson = JSON.stringify({ version: 2, key, value });
            files.push({ path: `${SYNC_CHATS_DIR}/${fileName}`, content: await makeEncryptedPayload(chatJson) });
            chatsIndex[key] = { size: chatJson.length };
        }

        // chats-index.enc.json
        const indexJson = JSON.stringify({ version: 2, exportedAt: Date.now(), chats: chatsIndex });
        files.push({ path: SYNC_CHATS_INDEX_PATH, content: await makeEncryptedPayload(indexJson) });

        return { files, meta: { stateSize: stateJson.length, chatCount: chatEntries.length, cardCount: characters.length } };
    }

    // ============================================================
    // 加密/解密
    // ============================================================
    async function deriveKey(passphrase, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(passphrase),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encrypt(plaintext, passphrase) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveKey(passphrase, salt);
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            plaintext
        );
        const result = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
        result.set(salt, 0);
        result.set(iv, salt.length);
        result.set(new Uint8Array(ciphertext), salt.length + iv.length);
        return result.buffer;
    }

    async function decrypt(ciphertext, passphrase) {
        const data = new Uint8Array(ciphertext);
        const salt = data.slice(0, 16);
        const iv = data.slice(16, 28);
        const encrypted = data.slice(28);
        const key = await deriveKey(passphrase, salt);
        return crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );
    }

    // ============================================================
    // gzip 压缩/解压
    // ============================================================
    async function gzipText(text) {
        if (typeof CompressionStream === 'undefined') {
            return new TextEncoder().encode(text).buffer;
        }
        const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
        return readStreamToBuffer(stream);
    }

    async function gunzipText(buffer) {
        if (typeof DecompressionStream === 'undefined') {
            return new TextDecoder().decode(buffer);
        }
        try {
            const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
            const text = await readStreamToBuffer(stream);
            return new TextDecoder().decode(text);
        } catch (e) {
            return new TextDecoder().decode(buffer);
        }
    }

    async function readStreamToBuffer(stream) {
        const chunks = [];
        const reader = stream.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const totalLength = chunks.reduce((a, b) => a + b.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result.buffer;
    }

    // ============================================================
    // GitHub API 请求封装
    // ============================================================
    function githubRequest(options, retryCount = 1) {
        return new Promise((resolve, reject) => {
            const doFetchFallback = () => fetch(options.url, {
                method: options.method,
                headers: options.headers,
                body: options.data,
            }).then(async (res) => {
                const text = await res.text();
                if (res.ok) return { responseText: text };
                throw new Error(`GitHub API ${res.status}: ${text}`);
            });

            const attempt = (left) => {
                if (typeof GM_xmlhttpRequest === 'function') {
                    GM_xmlhttpRequest({
                        ...options,
                        onload: (res) => {
                            if (res.status >= 200 && res.status < 300) {
                                resolve(res);
                            } else if (res.status === 0 || !res.status) {
                                // GM_xmlhttpRequest status=0 通常是 Tampermonkey/扩展拦截，尝试 fetch 兜底
                                if (left > 0) {
                                    log('GitHub request status=0, fallback to fetch...', left);
                                    doFetchFallback().then(resolve).catch(() => {
                                        setTimeout(() => attempt(left - 1), 1500);
                                    });
                                } else {
                                    doFetchFallback().then(resolve).catch((err) => {
                                        const msg = 'GitHub 请求被拦截或网络未连接（status=0）。请检查：1) Tampermonkey 是否被授予 api.github.com 访问权限；2) 是否有广告拦截器/浏览器扩展阻止了请求；3) 网络代理/VPN 是否正常。';
                                        const wrapped = new Error(msg);
                                        wrapped.status = 0;
                                        wrapped.response = res;
                                        wrapped.fetchError = err && err.message ? err.message : null;
                                        reject(wrapped);
                                    });
                                }
                            } else {
                                const err = new Error(`GitHub API ${res.status}: ${res.responseText}`);
                                err.status = res.status;
                                reject(err);
                            }
                        },
                        onerror: (err) => {
                            if (left > 0) {
                                log('GitHub request error, retrying...', left, err);
                                setTimeout(() => attempt(left - 1), 1500);
                            } else {
                                const wrapped = new Error('GitHub 请求失败: ' + (err && err.message ? err.message : '网络异常或被拦截'));
                                wrapped.original = err;
                                reject(wrapped);
                            }
                        },
                        ontimeout: () => {
                            if (left > 0) {
                                log('GitHub request timeout, retrying...', left);
                                setTimeout(() => attempt(left - 1), 1500);
                            } else {
                                reject(new Error('GitHub 请求超时'));
                            }
                        },
                    });
                } else {
                    fetch(options.url, {
                        method: options.method,
                        headers: options.headers,
                        body: options.data,
                    })
                        .then(async (res) => {
                            const text = await res.text();
                            if (res.ok) {
                                resolve({ responseText: text });
                            } else {
                                const err = new Error(`GitHub API ${res.status}: ${text}`);
                                err.status = res.status;
                                reject(err);
                            }
                        })
                        .catch((err) => {
                            if (left > 0) {
                                log('GitHub fetch error, retrying...', left, err);
                                setTimeout(() => attempt(left - 1), 1500);
                            } else {
                                reject(new Error('GitHub 请求失败: ' + (err && err.message ? err.message : '网络异常')));
                            }
                        });
                }
            };
            attempt(retryCount);
        });
    }

    // ============================================================
    // 工具函数
    // ============================================================
    async function getDeviceId() {
        let id = GM_getValue('device_id', '');
        if (!id) {
            id = 'device-' + Math.random().toString(36).slice(2) + '-' + Date.now();
            GM_setValue('device_id', id);
        }
        return id;
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToArrayBuffer(base64) {
        const binary = atob(base64.replace(/\s/g, ''));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    function stringToBase64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    function base64ToString(base64) {
        return decodeURIComponent(escape(atob(base64.replace(/\s/g, ''))));
    }

    function notify(message, isError = false) {
        log(message);
        showConfigStatus(message);
        try {
            if (typeof GM_notification === 'function') {
                GM_notification({ title: 'RP-Hub Sync', text: message });
            }
        } catch (e) {
            // ignore
        }
    }

    // ============================================================
    // 第 2 部分：广场 Hijack（LAN 优先 + 源站兜底 + 下载次数绕过）
    // ============================================================
    const TRANSPARENT_PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    // 只识别"资源类"URL：缩略图 / 预览图 / 头像 / 下载；
    // 其余 API（卡片详情 /api/cards/<id>、/comments、/view、/settings 等）一律放行不拦截
    function classifyPlazaUrl(rawUrl) {
        if (!rawUrl) return null;
        let path;
        try {
            path = new URL(rawUrl, location.href).pathname;
        } catch (e) {
            return null;
        }
        const m = path.match(/\/api\/cards\/([^/?#\s]+)(?:\/([^/?#\s]+))?\/?$/);
        if (!m) return null;
        const cardId = decodeURIComponent(m[1]);
        const action = m[2] || '';
        if (action === 'thumbnail' || action === 'preview-image' || action === 'avatar') {
            return { type: 'image', cardId, action };
        }
        if (action === 'download') {
            return { type: 'download-api', cardId };
        }
        return null;
    }

    function absolutize(url) {
        try {
            return new URL(url, location.href).href;
        } catch (e) {
            return url;
        }
    }

    function initPlazaHijack() {
        log('Plaza hijack initialized');
        // 网络与图片钩子必须在页面脚本渲染前装好（document-start）
        hookNetworkRequests();
        hookImageSrc();
        observeDownloadButtons();
        onDomReady(() => {
            if (isTopFrame()) injectFloatingPlazaButton();
            injectSourceStyle();
        });
    }

    function injectFloatingPlazaButton() {
        makeFloatButton('rphub-plaza-btn', 'RP-Hub 广场配置');
    }

    function injectSourceStyle() {
        const style = document.createElement('style');
        style.textContent = `
            [data-rphub-source="lan"] { outline: 2px solid #22c55e !important; outline-offset: -2px; }
            [data-rphub-source="source"] { outline: 2px solid #f59e0b !important; outline-offset: -2px; }
        `;
        document.head.appendChild(style);
    }

    // ---------- 网络请求挟持：仅拦截 POST /api/cards/<id>/download ----------
    // 源站的"下载次数"鉴权只是 UI 层面的 POST，角色卡文件本身可匿名直链下载。
    // 这里直接构造 download_url 返回给页面自己的 downloadCard 流程。
    function hookNetworkRequests() {
        const originalFetch = unsafeWindow.fetch;
        if (!originalFetch) return;

        unsafeWindow.fetch = async function (input, init) {
            const urlStr = typeof input === 'string' ? input : (input && input.url) || '';
            const method = ((init && init.method) || (typeof input === 'object' && input && input.method) || 'GET').toUpperCase();
            const cls = classifyPlazaUrl(urlStr);

            if (cls && cls.type === 'download-api' && method === 'POST') {
                log('Hijack download POST:', cls.cardId);
                try {
                    const resolved = await resolveDownload(cls.cardId, getConfig());
                    return fakeJsonResponse({ download_url: resolved.url, download_counted: false });
                } catch (e) {
                    log('Download resolve failed, fallback to source template:', e.message || e);
                    const template = getConfig().sourceDownloadTemplate;
                    return fakeJsonResponse({
                        download_url: template.replace('{id}', encodeURIComponent(cls.cardId)),
                        download_counted: false,
                    });
                }
            }

            // 缓存卡片详情，用于 postMessage 注入 plazaId
            const detailMatch = urlStr.match(/\/api\/cards\/([^/?#\s]+)\/?$/);
            if (detailMatch && method === 'GET') {
                const cardId = decodeURIComponent(detailMatch[1]);
                try {
                    const response = await originalFetch.call(this, input, init);
                    const clone = response.clone ? response.clone() : response;
                    clone.json().then((json) => {
                        if (json && (json.id || json.uuid)) {
                            plazaCardDetailCache[cardId] = {
                                name: json.name || json.title || null,
                                updatedAt: json.updated_at || json.updatedAt || null,
                            };
                        }
                    }).catch(() => { });
                    return response;
                } catch (e) {
                    return originalFetch.call(this, input, init);
                }
            }

            return originalFetch.call(this, input, init);
        };
    }

    // 跨隔离世界最稳妥的伪 Response（页面侧只用 resp.ok / resp.json()）
    function fakeJsonResponse(payload) {
        const text = JSON.stringify(payload);
        return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => JSON.parse(text),
            text: async () => text,
        };
    }

    // ---------- 图片挟持：缩略图/预览图 LAN 优先 ----------
    // 直接 hook HTMLImageElement.prototype.src，覆盖 Vue 属性赋值与 new Image() 两条路径；
    // LAN 命中时换成 blob: URL，规避 HTTPS 页面加载 HTTP 局域网资源的混合内容限制。
    function hookImageSrc() {
        const proto = unsafeWindow.HTMLImageElement && unsafeWindow.HTMLImageElement.prototype;
        if (proto) {
            const desc = Object.getOwnPropertyDescriptor(proto, 'src');
            if (desc && desc.set && desc.get) {
                Object.defineProperty(proto, 'src', {
                    configurable: true,
                    enumerable: desc.enumerable,
                    get: function () {
                        return desc.get.call(this);
                    },
                    set: function (value) {
                        const str = String(value);
                        const cls = classifyPlazaUrl(str);
                        if (!cls || cls.type !== 'image') {
                            desc.set.call(this, value);
                            return;
                        }
                        const reqId = (this._rphubReq = (this._rphubReq || 0) + 1);
                        try { this.dataset.rphubCardId = cls.cardId; } catch (e) { /* ignore */ }
                        desc.set.call(this, TRANSPARENT_PX);
                        resolveImage(cls, str, getConfig()).then((resolved) => {
                            if (this._rphubReq !== reqId) return;
                            desc.set.call(this, resolved.url);
                            try { this.dataset.rphubSource = resolved.source; } catch (e) { /* ignore */ }
                        }).catch(() => {
                            if (this._rphubReq !== reqId) return;
                            desc.set.call(this, absolutize(str));
                            try { this.dataset.rphubSource = 'source'; } catch (e) { /* ignore */ }
                        });
                    },
                });
                log('Image src hook installed');
            }
        }

        // MutationObserver 兜底：setAttribute('src') 路径与初始已有 img
        onDomReady(() => {
            const sweep = (img) => {
                if (!img.getAttribute) return;
                const src = img.getAttribute('src');
                if (!src || img.dataset.rphubSource) return;
                const cls = classifyPlazaUrl(src);
                if (!cls || cls.type !== 'image') return;
                img.src = src; // 触发上面的 setter 钩子
            };
            document.querySelectorAll('img').forEach(sweep);
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((m) => {
                    if (m.type === 'attributes') {
                        if (m.target.tagName === 'IMG') sweep(m.target);
                        return;
                    }
                    m.addedNodes.forEach((node) => {
                        if (node.tagName === 'IMG') sweep(node);
                        if (node.querySelectorAll) node.querySelectorAll('img').forEach(sweep);
                    });
                });
            });
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src'],
            });
        });
    }

    // 广场卡片详情缓存，用于点击下载时向 RP-Hub 父页面发送 plazaId
    const plazaCardDetailCache = {};

    // ---------- 下载按钮点击挟持（捕获阶段，优先于 Vue 处理器） ----------
    // 源站在次数为 0 时连 POST 都不发直接 toast"下载次数不足"，
    // 所以必须在点击层拦截并走自己的直链下载。
    function observeDownloadButtons() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest && e.target.closest('button, a, [role="button"]');
            if (!target) return;
            const text = `${target.textContent || ''} ${target.title || ''} ${target.getAttribute('aria-label') || ''}`.toLowerCase();
            if (!/下载|download/.test(text)) return;

            const cardId = findCardIdNearElement(target);
            if (!cardId) return; // 找不到卡 ID 则放行原逻辑

            e.preventDefault();
            e.stopImmediatePropagation();
            log('Hijacked download click for card:', cardId);

            // 向 RP-Hub 父页面广播该卡信息，便于导入时注入 plazaId
            notifyParentPlazaCard(cardId);

            doDirectDownload(cardId);
        }, true);
    }

    function notifyParentPlazaCard(cardId) {
        try {
            if (window.self === window.top) return; // 不是 iframe 则不发送
            const detail = plazaCardDetailCache[cardId] || {};
            window.parent.postMessage({
                type: 'RPHUB_PLAZA_CARD',
                cardId,
                name: detail.name || null,
                updatedAt: detail.updatedAt || null,
            }, 'https://blycr.github.io');
        } catch (e) {
            log('notifyParentPlazaCard failed:', e);
        }
    }

    function findCardIdNearElement(el) {
        let current = el;
        for (let i = 0; i < 12 && current && current !== document.documentElement; i++) {
            const img = current.querySelector &&
                current.querySelector('img[data-rphub-card-id], img[data-card-id], img[src*="/api/cards/"]');
            if (img) {
                const fromDataset = img.dataset.rphubCardId || img.dataset.cardId;
                if (fromDataset) return fromDataset;
                const m = (img.getAttribute('src') || '').match(/\/api\/cards\/([^/?#\s]+)/);
                if (m) return decodeURIComponent(m[1]);
            }
            current = current.parentElement;
        }
        return null;
    }

    // ---------- LAN manifest 缓存（含 in-flight 去重与失败短缓存） ----------
    let lanManifestCache = null;
    let lanManifestCacheTime = 0;
    let lanManifestOk = false;
    let lanManifestPromise = null;

    async function getLanManifest(cfg) {
        if (!cfg.enableLan || !cfg.lanBaseUrl) return null;
        const now = Date.now();
        const ttl = lanManifestOk ? 60000 : 20000; // 失败结果缓存更短，LAN 恢复后快速生效
        if (lanManifestCacheTime && now - lanManifestCacheTime < ttl) {
            return lanManifestCache;
        }
        if (lanManifestPromise) return lanManifestPromise;
        lanManifestPromise = (async () => {
            try {
                const url = `${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/manifest`;
                const res = await lanRequest(url, { timeout: 5000 });
                if (!res || res.status !== 200) throw new Error('HTTP ' + (res && res.status));
                lanManifestCache = JSON.parse(res.responseText);
                lanManifestOk = true;
                log('LAN manifest loaded, cards:', Object.keys(lanManifestCache).length);
            } catch (e) {
                log('LAN manifest fetch failed:', e.message || e);
                lanManifestCache = null;
                lanManifestOk = false;
            }
            lanManifestCacheTime = Date.now();
            lanManifestPromise = null;
            return lanManifestCache;
        })();
        return lanManifestPromise;
    }

    // GM_xmlhttpRequest 由扩展上下文发请求，可绕过 HTTPS 页面 -> HTTP 局域网的
    // 混合内容限制与 CORS；不可用时降级 fetch（可能被浏览器拦截，仅作兜底）
    function lanRequest(url, { responseType = '', timeout = 8000 } = {}) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest === 'function') {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    responseType: responseType || undefined,
                    timeout,
                    onload: resolve,
                    onerror: () => reject(new Error('LAN request failed')),
                    ontimeout: () => reject(new Error('LAN request timeout')),
                });
            } else {
                fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(timeout) })
                    .then(async (res) => {
                        if (responseType === 'blob') {
                            resolve({ status: res.status, response: await res.blob() });
                        } else {
                            resolve({ status: res.status, responseText: await res.text() });
                        }
                    })
                    .catch(reject);
            }
        });
    }

    // ---------- URL 解析 ----------
    // 图片 blob URL 不能随 img 加载完就回收（Vue 会复用/克隆 img 节点、
    // 翻译类扩展会重新请求同一 URL），改用 LRU 上限控制内存：
    // 只保留最近 24 个，超出才回收最旧的
    const BLOB_LRU_LIMIT = 24;
    const blobUrlLRU = [];

    function registerBlobUrl(url) {
        blobUrlLRU.push(url);
        while (blobUrlLRU.length > BLOB_LRU_LIMIT) {
            const evicted = blobUrlLRU.shift();
            try { URL.revokeObjectURL(evicted); } catch (e) { /* ignore */ }
        }
    }

    async function resolveImage(cls, rawUrl, cfg) {
        // 1. 局域网优先：manifest 命中则取本地原图 blob
        if (cfg.enableLan && cfg.lanBaseUrl) {
            try {
                const manifest = await getLanManifest(cfg);
                const entry = manifest && manifest[cls.cardId];
                if (entry && entry.filename && entry.is_image !== false) {
                    const lanUrl = `${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/image/${encodeURIComponent(entry.filename)}`;
                    const res = await lanRequest(lanUrl, { responseType: 'blob', timeout: 15000 });
                    const blob = res && res.status === 200 ? res.response : null;
                    if (blob && blob.size > 0) {
                        log('LAN image hit:', cls.cardId, '->', entry.filename);
                        const blobUrl = URL.createObjectURL(blob);
                        registerBlobUrl(blobUrl);
                        return { url: blobUrl, source: 'lan' };
                    }
                }
            } catch (e) {
                log('LAN image fetch failed:', cls.cardId, e.message || e);
            }
        }
        // 2. 回退：保持源站原始 URL 不改写（缩略图 CDN 链接本身可用）
        return { url: absolutize(rawUrl), source: 'source' };
    }

    async function resolveDownload(cardId, cfg) {
        // 1. 局域网优先
        if (cfg.enableLan && cfg.lanBaseUrl) {
            try {
                const manifest = await getLanManifest(cfg);
                const entry = manifest && manifest[cardId];
                if (entry && entry.filename && entry.is_image !== false) {
                    const lanUrl = `${cfg.lanBaseUrl.replace(/\/+$/, '')}/api/image/${encodeURIComponent(entry.filename)}`;
                    const res = await lanRequest(lanUrl, { responseType: 'blob', timeout: 30000 });
                    const blob = res && res.status === 200 ? res.response : null;
                    if (blob && blob.size > 0) {
                        const blobUrl = URL.createObjectURL(blob);
                        registerBlobUrl(blobUrl);
                        return {
                            url: blobUrl,
                            source: 'lan',
                            filename: entry.filename,
                        };
                    }
                }
            } catch (e) {
                log('LAN download fetch failed:', cardId, e.message || e);
            }
        }
        // 2. 源站直链（已验证无需鉴权：GET /api/cards/<id>/download/file）
        const template = cfg.sourceDownloadTemplate;
        return {
            url: template.replace('{id}', encodeURIComponent(cardId)),
            source: 'source',
            filename: cardId + '.png',
        };
    }

    // ---------- 下载执行与提示 ----------
    async function doDirectDownload(cardId) {
        showPlazaToast('正在准备下载...');
        try {
            const resolved = await resolveDownload(cardId, getConfig());
            const a = document.createElement('a');
            a.href = resolved.url;
            a.download = resolved.filename || (cardId + '.png');
            a.rel = 'noopener';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            a.remove();
            if (resolved.url.startsWith('blob:')) {
                setTimeout(() => URL.revokeObjectURL(resolved.url), 30000);
            }
            showPlazaToast(resolved.source === 'lan' ? '✅ 已从局域网下载' : '✅ 已从源站直链下载');
        } catch (e) {
            console.error('[RP-Hub Sync] Download failed:', e);
            showPlazaToast('❌ 下载失败: ' + (e.message || e), true);
        }
    }

    let plazaToastTimer = null;
    function showPlazaToast(msg, isError = false) {
        let el = document.getElementById('rphub-plaza-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'rphub-plaza-toast';
            el.style.cssText = `
                position: fixed;
                top: 16px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                padding: 10px 18px;
                border-radius: 999px;
                font-size: 13px;
                font-weight: 600;
                color: #fff;
                background: #111827;
                box-shadow: 0 6px 24px rgba(0,0,0,0.18);
                transition: opacity .3s;
                pointer-events: none;
                max-width: 90vw;
            `;
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.background = isError ? '#dc2626' : '#111827';
        el.style.opacity = '1';
        clearTimeout(plazaToastTimer);
        plazaToastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2500);
    }
})();
