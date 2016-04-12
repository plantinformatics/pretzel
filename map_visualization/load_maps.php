<?php
    $username = "root"; 
    $password = "";   
    $host = "localhost";
    $database="dav127_v01";
    
	$mysqli = new mysqli($host,$username,$password,$database);
	$mysqli->set_charset('utf8');
	if ($mysqli->connect_errno){
		echo "Failed to connect to MySQL: (". $mysqli->connect_errno . ")" . $mysqli->connect_error;
	}
	
	$myquery = "SELECT  `id`,`name`, `start`,`stop`,`maporder` FROM  `map` where `mapset` = 1";
    $result = $mysqli->query($myquery);

    $data = array();
    
    for ($x = 0; $x < $result->num_rows; $x++) {
        $data[] = $result->fetch_assoc();
    }
    
    echo "{\"maps\": ".json_encode($data)."}";     
     
?>