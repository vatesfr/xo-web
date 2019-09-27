
#### *Introduction :*  

To develop data visualization in Xen Orchestra, i decomposed the graphs into ten files :
#### Files used to instantiate the components :
* **index.tsx**:  VmCpuGraph, VmMemoryGraph, VmNetworkGraph, VmDiskGraph.
* **hostStats.tsx**: HostCpuGraph, HostMemoryGraph, HostNetworkGraph, HostLoadGraph.
* **storageStats.tsx**: SrIOPSGraph, SrIOThroGraph, SrLatencyGraph, SrIoWaitGraph.
* **miniStatsHost.tsx**: HostMemoryGraph, HostNetworkGraph, HostLoadGraph.
* **miniStatsStorage.tsx**: StorageThroughputGraph, StorageLatencyGraph, StorageIopsGraph, StorageIowaitGraph.
* **miniStatsVm.tsx**: VmDiskGraph, VmNetworkGraph, VmMemoryGraph, VmCpuGraph.
* **overview.tsx**: HostRamUsageGraph, StorageUsageGraph, VmPowerStateGraph, VmHostCpuUsageGraph.  
#### Files used to implement the components :
* **dashboard.tsx**: All the overview's graphs.
* **stats.tsx**: All the big graphs (VM, Storage and Host).
* **miniStats.tsx**: All the mini graphs(VM, Storage and host).

#### Display the graphs into a browser :
* Vm : ../vm
* Host : ../host
* storage : ../storage
* miniVms : ../miniStatsVm
* miniHosts : ../miniStatsHost
* miniStorages : ../miniStatsStorage
* overview : ../overview

*index.tsx :*
### VmCpuGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Object`s |`[{time: "2:22:40 PM", cpu0: 1.68, cpu1:0.73}, {time: "2:22:45 PM", cpu0: 1.609, cpu1:0.74},...]` | The source of data, in which each element is an object
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a vm, if any charts have the same syncId, those charts can sync the position of the tooltip 

### VmMemoryGraph  
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Object`s `[{time: "2:28:15 PM", memory: 2453870720}, {time: "2:28:20 PM", memory: 2453870720},...]`| The source of data, in which each element is an object
**total**| `Integer` | 245387072078 | The total value of the memory
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a vm, if any charts have the same syncId, those charts can sync the position of the tooltip 
       
### VmNetworkGraph
Name |  Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Object`s |`[{time:"2:35:05 PM", "vifs_0_(tx)":1753.2618, "vifs_0_(rx)": 2191.8948},{time:"2:35:10 PM", "vifs_0_(tx)":2185.2007, "vifs_0_(rx)": 2768.0464},...]` | The source of data, in which each element is an object
**threshold**|`Integer`|defaut: 1024e2| The threshold minimal of the scale, from which significant data evolutions can be seen.
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a vm, if any charts have the same syncId, those charts can sync the position of the tooltip 

### VmDiskGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Object`s |`[{ time: "2:49:45 PM"​, ​"xvds_a_(r)": 0, ​​"xvds_a_(w)": 0}, {time: "2:49:50   PM"​, ​"xvds_a_(r)":0, ​​"xvds_a_(w)": 4005.770},...]` | The source of data, in which each element is an object
**threshold**|`Integer`|defaut: 1024e3| The threshold minimal of the scale, from which significant data evolutions can be seen.
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a vm, if any charts have the same syncId, those charts can sync the position of the tooltip 

        
*hostStats.tsx :*
### HostCpuGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Objects`s |`[{ time: "3:08:50 PM", cpu0: 2.1, cpu1: 2.39 },{ time: "3:08:55 PM", cpu0: 3.1, cpu1: 4.09 },...]`| The source of data, in which each element is an object.
**syncId**| `String`| `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a host, if any charts have the same syncId, those charts can sync the position of the tooltip 

### HostMemoryGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Objects`s `[{time: "3:17:25 PM", memory: 7981998080 },{ time: "3:17:30 PM", memory: 7981998080 },...]` | The source of data, in which each element is an object.
**total**| `Integer` | 7981998080  | The total value of memory
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a host, If any charts have the same syncId, those charts can sync the position of the tooltip 

### HostNetworkGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Objects`s |`[{ time: "3:27:05 PM", "pifs_0_(rx)": 9406.5645, "pifs_0_(tx)": 41787.7617 },{ time: "3:27:10 PM", "pifs_0_(rx)": 9506.5645, "pifs_0_(tx)": 31787.7617 },...]`| The source of data, in which each element is an object.
**threshold**|`Integer`|defaut: 1024e3| The threshold minimal of the scale, from which significant data evolutions can be seen.
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a host, if any charts have the same syncId, those charts can sync the position of the tooltip 

### HostLoadGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Objects`s |`[{ time: "3:44:20 PM", load: 0.05 }, { time: "3:44:25 PM", load: 0.05 },...]` | The source of data, in which each element is an object
**threshold**|`Integer`|defaut: 1|The threshold minimal of the scale, from which significant data evolutions can be seen.
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a host, if any  charts have the same syncId, those charts can sync the position of the tooltip 

*storageStats.tsx :* 

### SrIOPSGraph  
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Objects`s |`[{ time: "3:54:15 PM", iops_r: 0, iops_w: 0 },{ time: "3:54:20 PM", iops_r: 0,  iops_w: 0 },..]` |The source of data, in which each element is an object
**threshold**|`Integer`|defaut: 40|The threshold minimal of the scale, from which significant data evolutions can be seen.
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a sr, if any  charts have the same syncId, those charts can sync the position of the tooltip
        
### SrIOThroGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Objects`s |`[{ thr_r: 0, thr_w: 0, time: "4:04:30 PM" },{ thr_r: 0, thr_w: 0, time: "4:04:35 PM" }, ...]` | The source of data of throughput, in which each element is an object
**threshold**|`Integer`|defaut: 1024e3| The threshold minimal of the scale, from which significant data evolutions can be seen.
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a sr, if any  charts have the same syncId, those charts can sync the position of the tooltip 

### SrLatencyGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Objects`s |`[{ latency_r: 0.135, latency_w: 1.842, time: "4:11:30 PM" }, {latency_r: 0.135, latency_w: 1.842, time: "4:11:35 PM" },..]`| The source of data, in which each element is an object
 **threshold**|`Integer`|defaut: 30| The threshold minimal of the scale, from which significant data evolutions can be seen.
 **syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a storage, if any  charts have the same syncId, those charts can sync the position of the tooltip 

### SrIoWaitGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Objects`s |`[{ iowait_pe1: 0, time: "4:23:30 PM" },{ iowait_pe1: 0, time: "4:23:35 PM" },...]` | The source of data, in which each element is an object
**threshold**|`Integer`|defaut: 5| The threshold minimal of the scale, from which significant data evolutions can be seen.
**syncId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | Id of a storage, if any charts have the same syncId, those charts can sync the position of the tooltip 

*miniStatsVm.tsx :* 

### VmCpuGraph  
Name | Type | Example | Description
------- | --- | --- | ---------  
**vmId**| `String` | `402b4559-217c-e9df-53b8-b548c2616e92` | The id of virtual machine

### VmMemoryGraph  
Name | Type | Example | Description
------- | --- | --- | ---------  
**vmId**|`String`| `402b4559-217c-e9df-53b8-b548c2616e92` | The id of virtual machine  

### VmDiskGraph    
Name | Type | Example | Description
------- | --- | --- | ---------  
**max**|`Integer`|4005.770 | The max of disk values
**data**|`Array` of `Object`s |`[{ time: "2:49:45 PM"​, ​"xvds_a_(r)": 0, ​​"xvds_a_(w)": 0}, {time: "2:49:50   PM"​, ​"xvds_a_(r)":0, ​​"xvds_a_(w)": 4005.770},...]`| The source of data, in which each element is an object

### VmNetworkGraph  
Name | Type | Example | Description
------- | --- | --- | ---------  
**max**|`Integer`| 99506.5645 | The max of network values
**data**|`Array` of `Object`s |`[{ time: "3:27:05 PM", "vifs_0_(rx)": 9406.5645, "vifs_0_(tx)": 41787.7617},{ time: "3:27:10 PM", "vifs_0_(rx)": 9506.5645, "vifs_0_(tx)": 31787.7617}, ...]` | The source of data, in which each element is an object


*miniStatsHost.tsx :* 
             
### HostMemoryGraph 
Name | Type | Example | Description
------- | --- | --- | ---------  
**hostId** |`String`| `402b4559-217c-e9df-53b8-b548c2616e92` | The id of the host

### HostCpuGraph 
Name | Type | Example | Description
------- | --- | --- | ---------  
**hostId** |`String`| `402b4559-217c-e9df-53b8-b548c2616e92` | The ids of hosts

### HostNetworkGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**max**| `Integer` | 95067.5645 |The max of networks values
**data**| `Array` of `Object`s |`[{ time: "3:27:05 PM", "pifs_0_(rx)": 9406.5645, "pifs_0_(tx)": 41787.7617},{ time: "3:27:10 PM", "pifs_0_(rx)": 9506.5645, "pifs_0_(tx)": 31787.7617 }, ...]` | The source of data, in which each element is an object

### HostLoadGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**max**| `Integer` | 1.04 |The max of loads values
**data**| `Array` of `Object`s |`[{ time: "3:44:20 PM", load: 0.05 }, { time: "3:44:25 PM", load: 0.05 },...]`| The source of data, in which each element is an object

*miniStatsStorage.tsx :* 

### StorageThroughputGraph 
Name | Type | Example | Description
------- | --- | --- | ---------
**max**| `Integer` | 18MiB |The max of throughput values
**data**| `Array` of `Object`s |`[{ thr_r: 0, thr_w: 0, time: "4:04:30 PM" },{ thr_r: 0, thr_w: 0, time: "4:04:35 PM" },...]`| The source of data, in which each element is an object

### StorageLatencyGraph 
Name | Type | Example | Description
------- | --- | --- | ---------
**max**| `Integer` | 40.04 | The max of latency values
**data**| `Array` of `Object`s | `[{ latency_r: 0.135, latency_w: 1.842, time: "4:11:30 PM" }, {latency_r: 0.135, latency_w: 1.842, time: "4:11:35 PM" },...]` | The source of data, in which each element is an object
The source of data

### StorageIopsGraph 
Name | Type | Example | Description
------- | --- | --- | ---------
**max**| `Integer` | 50 | The max of iops values
**data**| `Array` of `Object`s |`[{ time: "3:54:15 PM", iops_r: 0, iops_w: 0 },{ time: "3:54:20 PM", iops_r: 0,  iops_w: 0 },...]`| The source of data, in which each element is an object

### StorageIowaitGraph 
Name | Type | Example | Description
------- | --- | --- | ---------
**max**| `Integer` | 15 | The max of iowait values 
**data**| `Array` of `Object`s |`[{ time: "4:23:30 PM", iowait_pe1: 0 }, { time: "4:23:35 PM", iowait_pe1: 0 },...]`| The source of data, in which each element is an object 

*overview.tsx :* 
 
### HostRamUsageGraph 
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Integer` | 85014258 | The source data of usage of the RAM

### StorageUsageGraph
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Object`s |`[{ name: "usage", value: 999923671040 },{ name: "free", value: 1871270473728 }]`| The source of data, in which each element is an object
    
### VmPowerStateGraph 
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Object`s |`[{ name : "Running", value : 2 },{ name: "Halted", value: 1 }]`| The source of data, in which each element is an object

### VmHostCpuUsageGraph 
Name | Type | Example | Description
------- | --- | --- | ---------
**data**| `Array` of `Object`s |`[{ name1: "used vCPUs", UsedvCPUs: 6 }, { name1: "CPUs Total", CPUsTotal: 12 }]`| The source of data, in which each element is an object

