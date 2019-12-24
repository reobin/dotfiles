do shell script "pmset -g batt | grep InternalBattery | column -t"
set x to the result
set percentage to word 6 of x
set state to word 7 of x
set t1 to word 8 of x
set t2 to word 9 of x
set remaining to the word 10 of x
if remaining contains "remaining" then
	if state is "discharging" then
		return percentage & "% | " & t1 & ":" & t2 & " remaining"
	else if state is "charging" then
		return percentage & "% | " & t1 & ":" & t2 & " charging"
	else
		return percentage & "% | Fully charged"
	end if
else
	return percentage & "% | Calculating..."
end if

