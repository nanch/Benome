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

module.exports = {
    'Numeric': require('app/cluster/surfaces/Numeric'),
    'Interval': require('app/cluster/surfaces/Interval'),
    'Frequency': require('app/cluster/surfaces/Frequency'),
    'Text': require('app/cluster/surfaces/Text'),
    'TextLine': require('app/cluster/surfaces/TextLine'),
    'SingleChoice': require('app/cluster/surfaces/SingleChoice'),
    'TestSingleChoice': require('app/cluster/surfaces/TestSingleChoice'),
    'Boolean': require('app/cluster/surfaces/Boolean'),
    'SingleChoiceConstructor': require('app/cluster/surfaces/SingleChoiceConstructor'),

    'TestView': require('app/cluster/surfaces/Test'),
    'LabelAndName': require('app/cluster/surfaces/LabelAndName'),
    'BonusDetails': require('app/cluster/surfaces/BonusDetails'),
    'ClusterContainer': require('app/cluster/surfaces/ClusterContainer'),
    'SimpleSurfaceView': require('app/cluster/surfaces/SimpleSurfaceView')
}

