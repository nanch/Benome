/*
Copyright 2016 Steve Hazel

This file is part of Benome.

Benome is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License version 3
as published by the Free Software Foundation.

Benome is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with Benome. If not, see http://www.gnu.org/licenses/.
*/

var baseHTML = '' +
'<div class="detail-spectrum"></div>' + 
'<div class="timeline-container"></div>' +
'<div class="point-add-feedback"></div>' +
'<div class="overlay overlay-backing"></div>' +
'<div class="overlay overlay-backing2"></div>' +
'<div class="auto-action-container">' +
'    <div class="auto-action-overlay">' +
'        <div class="elapsed"></div>' +
'        <div class="button2 cancel">Cancel</div>' +
'        <div class="button2 done1">Done</div>' +
'        <div class="button2 more">More</div>' +
'    </div>' +
'' +
'    <div class="auto-action-overlay-details">' +
'        <form><textarea></textarea></form>' +
'        <div class="button2 add">Add</div>' +
'        <div class="button2 done2">Done</div>' +
'    </div>' +
'</div>' +
'' + 
'<div class="login-view">' +
'    <div class="title"></div>' +
'    <div class="authenticate">' +
'        <form>' +
'            <div class="username">' +
'                <input type="text" placeholder="Username"></input>' +
'            </div>' +
'            <div class="password">' +
'                <input type="password" placeholder="Password"></input>' +
'                <div class="button login">Go</div>' +
'            </div>' +
'            <div class="message"></div>' +
'        </form>' +
'    </div>' +
'</div>' +
'' + 
'<div class="quick-context-actions">' +
'    <div class="edit-label">' +
'        <input type="text"></input>' +
'        <div class="button rename">Go</div>' +
'    </div>' +
'</div>' +
'' + 
'<div class="admin-view">' +
'    <div class="left-col">' +
'    <div class="change-auth">' +
'		 <h4>Change Password</h4>' +
'        <form>' +
'            <div class="old-passphrase">' +
'                <input type="password" placeholder="Old Passphrase"></input>' +
'            </div>' +
'            <div class="new-passphrase">' +
'                <input type="password" placeholder="New Passphrase"></input>' +
'            </div>' +
'            <div class="new-passphrase2">' +
'                <input type="password" placeholder="And again"></input>' +
'            </div>' +
'            <div class="button-container">' +
'                <div class="button change">Go</div>' +
'            </div>' +
'        </form>' +
'    </div>' +
'    </div>' +
'' + 
'    <div class="right-col">' +
'		 <h4>Functions</h4>' +
'    <div class="fullscreen">' +
'        <div class="button toggle-fullscreen">Toggle Fullscreen</div>' +
'    </div>' +
'    <br>' + 
'' + 
'    <div class="export">' +
'        <div class="button export-data">Export</div>' +
'    </div>' +
'    <br>' + 
'' + 
'    <div class="logout">' +
'        <div class="button logout-session">Logout</div>' +
'    </div>' +
'	 </div>' + 
'' + 
'    <div class="button close-admin">Close</div>' +
'</div>' +
'' + 
'<div class="working-overlay overlay">' +
'    <div class="text"></div>' +
'</div>';

module.exports = baseHTML;